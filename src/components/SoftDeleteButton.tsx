'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from './ui/Button'
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
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    )
  }

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm text-red-600">Sure?</span>
      <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
        {loading ? '…' : 'Yes, delete'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  )
}
