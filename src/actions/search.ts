'use server';

import { requireSession } from '@/lib/session';
import { search, type SearchHit } from '@/lib/queries/search';

export async function searchAction(term: string): Promise<SearchHit[]> {
  const { business } = await requireSession();
  return search(business.id, term);
}
