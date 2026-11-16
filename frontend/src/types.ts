export interface StorageUnit {
  id: string;
  name: string;
  unit_type: string;
  map_x: number;
  map_y: number;
  width: number;
  height: number;
  photo_url: string | null;
}

export interface Shelf {
  id: string;
  storage_unit_id: string;
  label: string;
  photo_url: string | null;
}

export interface BinTag {
  id: string;
  shelf_id: string;
  label: string;
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
}

export interface ProjectBucket {
  id: string;
  name: string;
  description: string;
  owner: string;
  members: string;
  color: string;
}

export interface ProjectAllocation {
  item_id: string;
  project_id: string;
  quantity: number;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  specs: string;
  material: string;
  quantity: number;
  quantity_note: string;
  min_quantity: number;
  last_restock_total: number;
  last_restock_amount: number;
  home_bin_tag_id: string | null;
  home_location_label: string;
  purchased_at: string;
  last_stocked_at: string;
  added_by: string;
  purchase_url: string;
  cad_url: string;
  slicer_url: string;
}

export interface JournalEntry {
  id: number;
  item_id: string;
  item_name: string;
  action: string;
  source: string;
  from_location: string;
  to_location: string;
  quantity: number;
  created_at: string;
}

export interface BootstrapData {
  items: Item[];
  allocations: ProjectAllocation[];
  projects: ProjectBucket[];
  storage_units: StorageUnit[];
  shelves: Shelf[];
  bin_tags: BinTag[];
  journal: JournalEntry[];
}
