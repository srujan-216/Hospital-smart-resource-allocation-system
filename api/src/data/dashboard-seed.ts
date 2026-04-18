/**
 * Dashboard resource seed — the Beds and Labs that back the Staff Dashboard.
 *
 * Beds are organised into 4 blocks, each with a priority row and a regular row.
 * Lab blocks each hold 5 labs. Unit numbers are continuous across all blocks
 * (beds 1..N, labs 1..M).
 */
import { nanoid } from "nanoid";
import type { AppResource } from "../types.js";

export interface BedBlockSpec {
  id: string;                // "icu", "general", "pediatric", "isolation"
  name: string;              // "ICU Wing"
  priority: number;          // number of priority beds
  regular: number;           // number of regular beds
}

export interface LabBlockSpec {
  id: string;
  name: string;
  labs: number;
}

export const BED_BLOCKS: BedBlockSpec[] = [
  { id: "icu",        name: "ICU Wing",       priority: 4, regular: 4 },
  { id: "general",    name: "General Ward",   priority: 4, regular: 16 },
  { id: "pediatric",  name: "Pediatric Wing", priority: 4, regular: 8 },
  { id: "isolation",  name: "Isolation Ward", priority: 4, regular: 4 },
];

export const LAB_BLOCKS: LabBlockSpec[] = [
  { id: "pathology",    name: "Pathology",    labs: 5 },
  { id: "microbiology", name: "Microbiology", labs: 5 },
  { id: "biochemistry", name: "Biochemistry", labs: 5 },
  { id: "immunology",   name: "Immunology",   labs: 5 },
  { id: "radiology",    name: "Radiology",    labs: 5 },
  { id: "toxicology",   name: "Toxicology",   labs: 5 },
];

const FLOOR_BY_BLOCK: Record<string, number> = {
  pathology: 1, microbiology: 1, biochemistry: 2, immunology: 2, radiology: 3, toxicology: 3,
};

export function buildBedResources(): AppResource[] {
  const out: AppResource[] = [];
  let number = 0;
  for (const block of BED_BLOCKS) {
    for (const row of ["priority", "regular"] as const) {
      const count = row === "priority" ? block.priority : block.regular;
      for (let i = 0; i < count; i++) {
        number += 1;
        out.push({
          _id: `bed_${nanoid(8)}`,
          domain: "hospital",
          name: `Bed ${number}`,
          capacity: 1,
          available: true,
          location: { city: "Lucknow" },
          metadata: {
            kind: "bed",
            type: row === "priority" ? "icu" : "general",  // hints for matching.ts
            block_id: block.id,
            block: block.name,
            row,
            number,
            patient: null,
          },
        });
      }
    }
  }
  return out;
}

export function buildLabResources(): AppResource[] {
  const out: AppResource[] = [];
  let number = 0;
  for (const block of LAB_BLOCKS) {
    for (let i = 0; i < block.labs; i++) {
      number += 1;
      const floor = FLOOR_BY_BLOCK[block.id] ?? 1;
      out.push({
        _id: `lab_${nanoid(8)}`,
        domain: "hospital",
        name: `Lab ${number}`,
        capacity: 1,
        available: true,
        location: { city: "Lucknow" },
        metadata: {
          kind: "lab",
          type: "lab",
          block_id: block.id,
          block: block.name,
          number,
          lab_id: `LAB-${String(number).padStart(2, "0")}`,
          room_no: `${floor}${String(i + 1).padStart(2, "0")}`,  // 101, 102 ... 301
          status: "available",
          emergency: false,
          assigned_to: null,
          assigned_at: null,
        },
      });
    }
  }
  return out;
}
