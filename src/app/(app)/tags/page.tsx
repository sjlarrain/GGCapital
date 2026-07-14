import { getTagCatalogs } from '@/lib/actions/tags'
import TagCatalogManager from '@/components/TagCatalogManager'

export default async function TagsPage() {
  const tags = await getTagCatalogs()

  return (
    <div>
      <div className="mb-6">
        <h1 className="title is-3">Tag Management</h1>
        <p className="subtitle is-6 has-text-grey">All users can create tags. Near-match warnings prevent duplicates.</p>
      </div>

      <div className="columns is-multiline">
        <div className="column is-half">
          <TagCatalogManager catalog="industries" label="Industries & Thesis" items={tags.industries} />
        </div>
        <div className="column is-half">
          <TagCatalogManager catalog="regions" label="Regions / Countries" items={tags.regions} />
        </div>
        <div className="column is-half">
          <TagCatalogManager catalog="stages" label="Investment Stage" items={tags.stages} />
        </div>
        <div className="column is-half">
          <TagCatalogManager catalog="types" label="Types" items={tags.types} protectedNames={['VC', 'Fund', 'Company']} />
        </div>
        <div className="column is-half">
          <TagCatalogManager catalog="statuses" label="Status" items={tags.statuses} />
        </div>
        <div className="column is-half">
          <TagCatalogManager catalog="meetingTypes" label="Meeting Types" items={tags.meetingTypes} />
        </div>
        <div className="column is-half">
          <TagCatalogManager catalog="investmentFocus" label="Investment Focus" items={tags.investmentFocus} />
        </div>
      </div>
    </div>
  )
}
