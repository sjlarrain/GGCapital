'use client'
import { useState } from 'react'
import { flagMeetingFollowUp } from '@/lib/actions/interactions'

interface Props {
  meetingId: string
  companyId: string
  userId: string
}

export default function FlagFollowUpButton({ meetingId, companyId, userId }: Props) {
  const [flagged, setFlagged] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFlag = async () => {
    setLoading(true)
    try {
      await flagMeetingFollowUp(meetingId, companyId, userId)
      setFlagged(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className="button is-light is-small"
      onClick={handleFlag}
      disabled={loading || flagged}
    >
      {flagged ? '🔔 Flagged' : '🔔 Flag follow-up'}
    </button>
  )
}
