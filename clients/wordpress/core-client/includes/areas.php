<?php
// Which areas a home is in (docs/search.md, "Matching a home to areas by outline"; Patric,
// 2026-10-04, question 133 a): the area the CRM named, plus every area whose outline holds the
// home's map point. The links live in one table of the plugin's, written when a record is
// stored and read by the list query (includes/query.php), so no visitor's search ever touches an
// outline. They are recomputed only when what they depend on changed (Patric: a point or an
// outline changes very rarely): a home's point or CRM area, or an area's outline, compared against
// the values the index row held before the write. A plugin update rebuilds every link in the
// background (includes/store.php schedules it), so a changed rule reaches every home.

declare(strict_types=1);

const CORE_CLIENT_LINK_REBUILD = 'core_client_link_rebuild';
const CORE_CLIENT_LINK_BATCH = 200;
/** The bounds are widened by about a metre, so the six decimals the row keeps never exclude a point on the edge. */
const CORE_CLIENT_BOUNDS_MARGIN = 0.00001;

function core_client_links_table(): string
{
    global $wpdb;
    return $wpdb->prefix . 'core_property_areas';
}

/** The kinds of record that are in an area: a home and a project. An office's point is where it works, not where it is sold. */
function core_client_linked_datatype(string $datatype): bool
{
    return $datatype === 'property' || $datatype === 'project';
}

/**
 * Whether a point lies inside an outline as the CRM draws it: GeoJSON MultiPolygon coordinates,
 * a list of polygons, each a list of rings of [longitude, latitude] points, the first ring the
 * outer edge and the rest holes. Inside means inside one polygon's outer ring and none of its
 * holes (the even-odd rule, ray casting). Anything that is not such a list holds no point.
 */
function core_client_point_in_polygon(float $lat, float $lng, mixed $multipolygon): bool
{
    foreach (is_array($multipolygon) ? $multipolygon : [] as $polygon) {
        if (!is_array($polygon) || !isset($polygon[0]) || !core_client_point_in_ring($lat, $lng, $polygon[0])) {
            continue;
        }
        foreach (array_slice($polygon, 1) as $hole) {
            if (core_client_point_in_ring($lat, $lng, $hole)) {
                continue 2;
            }
        }
        return true;
    }
    return false;
}

/** @param mixed $ring a list of [longitude, latitude] points */
function core_client_point_in_ring(float $lat, float $lng, mixed $ring): bool
{
    if (!is_array($ring) || count($ring) < 3) {
        return false;
    }
    $inside = false;
    $points = array_values($ring);
    $count = count($points);
    for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
        [$x1, $y1] = core_client_ring_point($points[$i]);
        [$x2, $y2] = core_client_ring_point($points[$j]);
        if ($x1 === null || $x2 === null || $y1 === null || $y2 === null) {
            return false;
        }
        if (($y1 > $lat) !== ($y2 > $lat) && $lng < ($x2 - $x1) * ($lat - $y1) / ($y2 - $y1) + $x1) {
            $inside = !$inside;
        }
    }
    return $inside;
}

/** @return array{0: float|null, 1: float|null} longitude, latitude */
function core_client_ring_point(mixed $point): array
{
    $number = fn (mixed $value): ?float => is_int($value) || is_float($value) ? (float) $value : null;
    return is_array($point) ? [$number($point[0] ?? null), $number($point[1] ?? null)] : [null, null];
}

/**
 * The smallest box around an outline, widened by the margin: min latitude, max latitude, min
 * longitude, max longitude. Null for no outline or one without a point.
 *
 * @return array{min_lat: float, max_lat: float, min_lng: float, max_lng: float}|null
 */
function core_client_polygon_bounds(mixed $multipolygon): ?array
{
    $lats = [];
    $lngs = [];
    foreach (is_array($multipolygon) ? $multipolygon : [] as $polygon) {
        foreach (is_array($polygon) ? $polygon : [] as $ring) {
            foreach (is_array($ring) ? $ring : [] as $point) {
                [$lng, $lat] = core_client_ring_point($point);
                if ($lng !== null && $lat !== null) {
                    $lats[] = $lat;
                    $lngs[] = $lng;
                }
            }
        }
    }
    if ($lats === []) {
        return null;
    }
    return [
        'min_lat' => min($lats) - CORE_CLIENT_BOUNDS_MARGIN,
        'max_lat' => max($lats) + CORE_CLIENT_BOUNDS_MARGIN,
        'min_lng' => min($lngs) - CORE_CLIENT_BOUNDS_MARGIN,
        'max_lng' => max($lngs) + CORE_CLIENT_BOUNDS_MARGIN,
    ];
}

/** One short value that changes when the outline does, kept on the area's index row to compare against. */
function core_client_polygon_hash(mixed $multipolygon): ?string
{
    return is_array($multipolygon) && $multipolygon !== [] ? md5((string) wp_json_encode($multipolygon)) : null;
}

/**
 * After an index row was written: redo the links the record takes part in, when what they
 * depend on changed. `$before` is the index row as it stood before the write (null for a new
 * record), with `lat`, `lng`, `area_id` and `polygon_hash`.
 */
function core_client_link_record(int $post_id, string $datatype, object $data, ?object $before): void
{
    if ($datatype === 'area') {
        $hash = core_client_polygon_hash($data->polygon ?? null);
        if ($before === null || ($before->polygon_hash ?? null) !== $hash) {
            core_client_relink_area((string) ($data->id ?? ''), $data->polygon ?? null);
        }
        return;
    }
    if (!core_client_linked_datatype($datatype)) {
        return;
    }
    $point = core_client_record_point($data);
    $crm_area = is_object($data->address ?? null) && is_string($data->address->area_id ?? null) ? $data->address->area_id : null;
    $same = $before !== null
        && core_client_same_number($before->lat ?? null, $point[0])
        && core_client_same_number($before->lng ?? null, $point[1])
        && ($before->area_id ?? null) === $crm_area;
    if (!$same) {
        core_client_link_home($post_id, $point[0], $point[1], $crm_area);
    }
}

/** @return array{0: float|null, 1: float|null} latitude, longitude */
function core_client_record_point(object $data): array
{
    $number = fn (mixed $value): ?float => is_int($value) || is_float($value) ? (float) $value : null;
    return [$number($data->lat ?? null), $number($data->lng ?? null)];
}

/** Equal to the six decimals the index row keeps. */
function core_client_same_number(mixed $stored, ?float $value): bool
{
    if ($stored === null || $value === null) {
        return $stored === null && $value === null;
    }
    return abs((float) $stored - $value) < 0.000001;
}

/**
 * The areas one home is in: the CRM's, and every area whose bounds hold the point and whose
 * outline then holds it. The bounds come from the index, so only the few candidates are opened.
 *
 * @return list<string>
 */
function core_client_home_areas(?float $lat, ?float $lng, ?string $crm_area): array
{
    global $wpdb;
    $areas = $crm_area !== null && $crm_area !== '' ? [$crm_area] : [];
    if ($lat === null || $lng === null) {
        return $areas;
    }
    $index = core_client_index_table();
    $candidates = $wpdb->get_results($wpdb->prepare(
        "SELECT post_id, remote_id FROM $index WHERE datatype = 'area' AND min_lat <= %f AND max_lat >= %f AND min_lng <= %f AND max_lng >= %f",
        $lat,
        $lat,
        $lng,
        $lng,
    ));
    foreach ($candidates ?: [] as $candidate) {
        $area = core_client_item((int) $candidate->post_id);
        if (is_array($area) && core_client_point_in_polygon($lat, $lng, $area['polygon'] ?? null)) {
            $areas[] = (string) $candidate->remote_id;
        }
    }
    return array_values(array_unique($areas));
}

/** Replace one home's rows in the link table. */
function core_client_link_home(int $post_id, ?float $lat, ?float $lng, ?string $crm_area): void
{
    core_client_write_links($post_id, core_client_home_areas($lat, $lng, $crm_area));
}

/** @param list<string> $area_ids */
function core_client_write_links(int $post_id, array $area_ids): void
{
    global $wpdb;
    $links = core_client_links_table();
    $wpdb->delete($links, ['post_id' => $post_id]);
    foreach ($area_ids as $area_id) {
        $wpdb->insert($links, ['post_id' => $post_id, 'area_id' => $area_id]);
    }
}

/**
 * Replace one area's rows: the homes whose CRM area it is, and every home whose point its
 * outline holds, one pass over the homes' points from the index, the bounds first.
 */
function core_client_relink_area(string $area_id, mixed $polygon): void
{
    global $wpdb;
    if ($area_id === '') {
        return;
    }
    $index = core_client_index_table();
    $links = core_client_links_table();
    $wpdb->delete($links, ['area_id' => $area_id]);
    $post_ids = array_map('intval', $wpdb->get_col($wpdb->prepare("SELECT post_id FROM $index WHERE datatype IN ('property', 'project') AND area_id = %s", $area_id)));
    $bounds = core_client_polygon_bounds($polygon);
    if ($bounds !== null) {
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT post_id, lat, lng FROM $index WHERE datatype IN ('property', 'project') AND lat BETWEEN %f AND %f AND lng BETWEEN %f AND %f",
            $bounds['min_lat'],
            $bounds['max_lat'],
            $bounds['min_lng'],
            $bounds['max_lng'],
        ));
        foreach ($rows ?: [] as $row) {
            if (core_client_point_in_polygon((float) $row->lat, (float) $row->lng, $polygon)) {
                $post_ids[] = (int) $row->post_id;
            }
        }
    }
    foreach (array_unique($post_ids) as $post_id) {
        $wpdb->insert($links, ['post_id' => $post_id, 'area_id' => $area_id]);
    }
}

/** A record's rows go with it: a home's by its post, an area's by its id. */
function core_client_unlink(int $post_id, string $datatype, string $remote_id): void
{
    global $wpdb;
    $links = core_client_links_table();
    $wpdb->delete($links, $datatype === 'area' ? ['area_id' => $remote_id] : ['post_id' => $post_id]);
}

/**
 * The rebuild a plugin update schedules: every home's links again, a batch at a time, each batch
 * its own scheduled action so no single request runs long. The areas' bounds were rewritten by
 * the reindex before the first batch runs.
 */
function core_client_rebuild_links(int $offset = 0): void
{
    global $wpdb;
    $index = core_client_index_table();
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT post_id, lat, lng, area_id FROM $index WHERE datatype IN ('property', 'project') ORDER BY post_id LIMIT %d OFFSET %d",
        CORE_CLIENT_LINK_BATCH,
        $offset,
    ));
    foreach ($rows ?: [] as $row) {
        core_client_link_home(
            (int) $row->post_id,
            $row->lat === null ? null : (float) $row->lat,
            $row->lng === null ? null : (float) $row->lng,
            is_string($row->area_id) ? $row->area_id : null,
        );
    }
    if (count($rows ?: []) === CORE_CLIENT_LINK_BATCH) {
        as_enqueue_async_action(CORE_CLIENT_LINK_REBUILD, ['offset' => $offset + CORE_CLIENT_LINK_BATCH], 'core-client');
    }
}

add_action(CORE_CLIENT_LINK_REBUILD, function (int $offset = 0): void {
    core_client_rebuild_links($offset);
});
