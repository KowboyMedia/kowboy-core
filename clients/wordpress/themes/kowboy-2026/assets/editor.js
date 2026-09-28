// The editor side of every section block (inc/blocks.php): one settings panel built from the
// attributes' `control` keys in block.json, and a preview rendered by the server. Plain
// WordPress packages, no build step.
(function (wp) {
  'use strict';
  var el = wp.element.createElement;
  var Fragment = wp.element.Fragment;
  var useBlockProps = wp.blockEditor.useBlockProps;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var MediaUpload = wp.blockEditor.MediaUpload;
  var MediaUploadCheck = wp.blockEditor.MediaUploadCheck;
  var c = wp.components;
  var ServerSideRender = wp.serverSideRender;

  function mediaButton(label, allowed, multiple, onSelect, value) {
    return el(
      MediaUploadCheck,
      null,
      el(MediaUpload, {
        allowedTypes: allowed,
        multiple: multiple,
        gallery: multiple,
        value: value,
        onSelect: onSelect,
        render: function (open) {
          return el(c.Button, { variant: 'secondary', onClick: open }, label);
        },
      }),
    );
  }

  function removeButton(value, onChange, label) {
    return value && value.url
      ? el(
          c.Button,
          {
            variant: 'link',
            isDestructive: true,
            onClick: function () {
              onChange({});
            },
          },
          label,
        )
      : null;
  }

  /** The builders, one per `control` value in block.json; a text field when none matches. */
  var builders = {
    textarea: function (props, value, onChange) {
      return el(
        c.TextareaControl,
        Object.assign(props, { value: value || '', onChange: onChange }),
      );
    },
    number: function (props, value, onChange) {
      return el(
        c.TextControl,
        Object.assign(props, {
          type: 'number',
          value: value === undefined ? '' : value,
          onChange: function (v) {
            onChange(v === '' ? undefined : Number(v));
          },
        }),
      );
    },
    toggle: function (props, value, onChange) {
      return el(c.ToggleControl, Object.assign(props, { checked: !!value, onChange: onChange }));
    },
    select: function (props, value, onChange, def) {
      return el(
        c.SelectControl,
        Object.assign(props, {
          value: value || '',
          options: Object.keys(def.options || {}).map(function (k) {
            return { value: k, label: def.options[k] };
          }),
          onChange: onChange,
        }),
      );
    },
    url: function (props, value, onChange) {
      return el(
        c.TextControl,
        Object.assign(props, { type: 'url', value: value || '', onChange: onChange }),
      );
    },
    image: function (props, value, onChange) {
      return el(
        c.BaseControl,
        props,
        el(
          'div',
          { className: 'k-editor-media' },
          value && value.url
            ? el('img', {
                src: value.url,
                alt: '',
                style: { maxWidth: '100%', display: 'block', marginBottom: '8px' },
              })
            : null,
          mediaButton(
            value && value.url ? 'Byt bild' : 'Välj bild',
            ['image'],
            false,
            function (m) {
              onChange({ id: m.id, url: m.url, alt: m.alt || '' });
            },
            value && value.id,
          ),
          removeButton(value, onChange, 'Ta bort'),
        ),
      );
    },
    images: function (props, value, onChange) {
      var list = Array.isArray(value) ? value : [];
      return el(
        c.BaseControl,
        props,
        el(
          'div',
          { className: 'k-editor-media' },
          list.length
            ? el(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' } },
                list.map(function (img, i) {
                  return el('img', {
                    key: i,
                    src: img.url,
                    alt: '',
                    style: { width: '56px', height: '56px', objectFit: 'cover' },
                  });
                }),
              )
            : null,
          mediaButton(
            list.length ? 'Ändra bilder' : 'Välj bilder',
            ['image'],
            true,
            function (ms) {
              onChange(
                (Array.isArray(ms) ? ms : [ms]).map(function (m) {
                  return { id: m.id, url: m.url, alt: m.alt || '' };
                }),
              );
            },
            list.map(function (img) {
              return img.id;
            }),
          ),
          list.length
            ? el(
                c.Button,
                {
                  variant: 'link',
                  isDestructive: true,
                  onClick: function () {
                    onChange([]);
                  },
                },
                'Ta bort alla',
              )
            : null,
        ),
      );
    },
    video: function (props, value, onChange) {
      return el(
        c.BaseControl,
        props,
        el(
          'div',
          { className: 'k-editor-media' },
          value && value.url ? el('p', null, value.filename || value.url) : null,
          mediaButton(
            value && value.url ? 'Byt film' : 'Välj film',
            ['video'],
            false,
            function (m) {
              onChange({ id: m.id, url: m.url, filename: m.filename });
            },
            value && value.id,
          ),
          removeButton(value, onChange, 'Ta bort'),
        ),
      );
    },
    repeater: function (props, value, onChange, def, key) {
      return repeater(def, Array.isArray(value) ? value : [], onChange, key);
    },
    text: function (props, value, onChange) {
      return el(c.TextControl, Object.assign(props, { value: value || '', onChange: onChange }));
    },
  };

  /** One control for one attribute (or one field of a repeater row). */
  function control(def, value, onChange, key) {
    var props = {
      key: key,
      label: def.label || key,
      help: def.help,
      __nextHasNoMarginBottom: true,
    };
    return (builders[def.control] || builders.text)(props, value, onChange, def, key);
  }

  /** Rows of sub-fields, with add, remove and move. */
  function repeater(def, rows, onChange, key) {
    var fields = def.fields || {};
    var max = def.max || 50;
    function update(index, name, v) {
      var next = rows.slice();
      next[index] = Object.assign(
        {},
        next[index],
        (function () {
          var o = {};
          o[name] = v;
          return o;
        })(),
      );
      onChange(next);
    }
    function move(index, delta) {
      var next = rows.slice();
      var row = next.splice(index, 1)[0];
      next.splice(index + delta, 0, row);
      onChange(next);
    }
    return el(
      c.BaseControl,
      { key: key, label: def.label, help: def.help, __nextHasNoMarginBottom: true },
      rows.map(function (row, index) {
        return el(
          c.Card,
          { key: index, size: 'small', style: { marginBottom: '8px' } },
          el(
            c.CardBody,
            null,
            Object.keys(fields).map(function (name) {
              return control(
                fields[name],
                row[name],
                function (v) {
                  update(index, name, v);
                },
                name,
              );
            }),
            el(
              c.Flex,
              { justify: 'flex-start' },
              el(
                c.Button,
                {
                  size: 'small',
                  variant: 'tertiary',
                  disabled: index === 0,
                  onClick: function () {
                    move(index, -1);
                  },
                },
                '↑',
              ),
              el(
                c.Button,
                {
                  size: 'small',
                  variant: 'tertiary',
                  disabled: index === rows.length - 1,
                  onClick: function () {
                    move(index, 1);
                  },
                },
                '↓',
              ),
              el(
                c.Button,
                {
                  size: 'small',
                  variant: 'tertiary',
                  isDestructive: true,
                  onClick: function () {
                    onChange(
                      rows.filter(function (_, i) {
                        return i !== index;
                      }),
                    );
                  },
                },
                'Ta bort',
              ),
            ),
          ),
        );
      }),
      rows.length < max
        ? el(
            c.Button,
            {
              variant: 'secondary',
              onClick: function () {
                onChange(rows.concat([{}]));
              },
            },
            'Lägg till',
          )
        : null,
    );
  }

  function edit(blockType) {
    return function (props) {
      var defs = blockType.attributes || {};
      var controls = Object.keys(defs)
        .filter(function (name) {
          return defs[name].control;
        })
        .map(function (name) {
          var def = defs[name];
          // A media choice hides the fields of the other kinds.
          if (defs.mediaType && ['images', 'vimeoUrl', 'video'].indexOf(name) > -1) {
            var wanted = { images: 'images', vimeoUrl: 'vimeo', video: 'video' }[name];
            if ((props.attributes.mediaType || 'images') !== wanted) return null;
          }
          return control(
            def,
            props.attributes[name],
            function (v) {
              var change = {};
              change[name] = v;
              props.setAttributes(change);
            },
            name,
          );
        });
      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(c.PanelBody, { title: blockType.title, initialOpen: true }, controls),
        ),
        el(
          'div',
          useBlockProps({ className: 'k-editor-preview' }),
          el(ServerSideRender, { block: blockType.name, attributes: props.attributes }),
        ),
      );
    };
  }

  (window.kowboyBlocks || []).forEach(function (name) {
    var type = wp.blocks.getBlockType(name);
    if (type) return;
    wp.blocks.registerBlockType(name, {
      edit: function (props) {
        return edit(wp.blocks.getBlockType(name))(props);
      },
      save: function () {
        return null;
      },
    });
  });
})(window.wp);
