import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// A second fake CRM, speaking snake_case, to prove the engine depends on neither vocabulary.
// Fields beyond identity are named `fake_*` for the same reason as in the other fake adapter:
// the universal model has no descriptive fields yet, and a dummy provider must not invent them.

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const number = (value: unknown): number | null =>
  typeof value === 'number' ? value : typeof value === 'string' && value ? Number(value) : null;

const STAGES = new Set(['pre', 'active', 'done', 'cancelled']);

const require_ = (record: Raw, field: string): string => {
  const id = text(record[field]);
  if (!id) throw new Error(`a record without ${field} cannot be mapped`);
  return id;
};

const property = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = require_(record, 'object_id');
  const stage = String(record['stage']);
  if (!STAGES.has(stage)) throw new Error(`unknown stage "${stage}"`);

  return {
    officeId: text(record['branch_id']),
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      office_id: text(record['branch_id']),
      agent_ids: Array.isArray(record['staff']) ? record['staff'].map(String) : [],
      area_ids: Array.isArray(record['districts']) ? record['districts'].map(String) : [],
      association_id: text(record['coop_id']),
      fake_state: stage,
      fake_label: text(record['street']),
      fake_amount: number(record['price']),
      display: {},
      provider_extras: { 'fake-polling': { object_type: String(record['object_type']) } },
    },
  };
};

const byField =
  (
    idField: string,
    labelField: string,
    officeField: string | null,
  ): ((raw: unknown) => MappedRecord) =>
  (raw: unknown): MappedRecord => {
    const record = raw as Raw;
    const id = require_(record, idField);
    return {
      officeId: officeField ? text(record[officeField]) : null,
      remoteUpdatedAt: text(record['changed_at']),
      data: { id, fake_label: text(record[labelField]), display: {}, provider_extras: {} },
    };
  };

export const mappers: Mappers = {
  property,
  office: byField('branch_id', 'branch_name', 'branch_id'),
  agent: byField('staff_id', 'full_name', 'branch_id'),
  area: byField('district_id', 'district_name', null),
  association: byField('coop_id', 'coop_name', null),
};
