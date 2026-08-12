import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function normalizeMemberRecord(record) {
  if (!record || typeof record !== 'object') return record

  const normalized = {
    ...record,
    certificate_date: record.certificate_date || null,
  }

  // These values are managed by Postgres and should not be sent back
  // from an existing roster record during an update.
  delete normalized.id
  delete normalized.created_at
  delete normalized.updated_at

  return normalized
}

function memberSafeBuilder(builder) {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === 'insert') {
        return (values, options) => {
          const payload = Array.isArray(values)
            ? values.map(normalizeMemberRecord)
            : normalizeMemberRecord(values)
          return target.insert(payload, options)
        }
      }

      if (prop === 'update') {
        return (values, options) => target.update(normalizeMemberRecord(values), options)
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

// Keep the existing app API unchanged, while making Connect Team member
// inserts/updates safe for nullable Postgres date fields.
export const supabase = new Proxy(client, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (relation) => {
        const builder = target.from(relation)
        return relation === 'members' ? memberSafeBuilder(builder) : builder
      }
    }

    const value = Reflect.get(target, prop, receiver)
    return typeof value === 'function' ? value.bind(target) : value
  },
})
