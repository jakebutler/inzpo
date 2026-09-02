import { getFacetsWithValues } from "@/lib/ontology";

export interface TrayFacet {
  id: string;
  name: string;
  values: string[];
}

export async function loadTrayFacets(): Promise<TrayFacet[]> {
  const facets = await getFacetsWithValues();
  return facets.map((f) => ({ id: f.id, name: f.name, values: f.values.map((v) => v.value) }));
}
