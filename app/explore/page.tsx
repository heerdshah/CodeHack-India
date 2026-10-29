import { Suspense } from 'react'
import { ExploreApp } from '@/components/resourcx/explore-app'

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreApp />
    </Suspense>
  )
}