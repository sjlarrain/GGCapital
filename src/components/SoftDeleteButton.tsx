'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softDeleteCompany } from '@/lib/actions/companies'
import { softDeleteContact } from '@/lib/actions/contacts'
import { softDeleteMeeting } from '@/lib/actions/meetings'

interface Props {
  entityType: 'company' | 'contact' | 'meeting'
  id: string
  userId: string
}

export default function SoftDeleteButton({ entityType, id, userId }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      if (entityType === 'company') await softDeleteCompany(id, userId)
      if (entityType === 'contact') await softDeleteContact(id, userId)
      if (entityType === 'meeting') await softDeleteMeeting(id, userId)
      router.refresh()
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button className="button is-danger is-small" onClick={() => setConfirming(true)}>
        Delete
      </button>
    )
  }

  return (
    <div className="buttons">
      <span className="has-text-danger is-size-7 mr-2" style={{ alignSelf: 'center' }}>Sure?</span>
      <button className="button is-danger is-small" onClick={handleDelete} disabled={loading}>
        {loading ? '…' : 'Yes, delete'}
      </button>
      <button className="button is-ghost is-small" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </div>
  )
}
