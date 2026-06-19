import { createClient } from '@/lib/supabase/server'
import { getTagCatalogs } from '@/lib/actions/tags'
import TagCatalogManager from '@/components/TagCatalogManager'

export default async function TagsPage() {
  const tags = await getTagCatalogs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tag Management</h1>
        <p className="text-sm text-gray-500">All users can create tags. Near-match warnings prevent duplicates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TagCatalogManager catalog="industries" label="Industries" items={tags.industries} />
        <TagCatalogManager catalog="regions" label="Regions / Countries" items={tags.regions} />
        <TagCatalogManager catalog="stages" label="Stages" items={tags.stages} />
        <TagCatalogManager catalog="types" label="Types" items={tags.types} />
        <TagCatalogManager catalog="statuses" label="Statuses" items={tags.statuses} />
        <TagCatalogManager catalog="meetingTypes" label="Meeting Types" items={tags.meetingTypes} />
      </div>
    </div>
  )
}
