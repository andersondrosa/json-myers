export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

export type ReorderChange = { id: string | number; from: number; to: number };

export type DiffOutput = {
  added: JSONObject[];
  removed: JSONObject[];
  updated: { id: string | number; diff: JSONObject }[];
  reordered?: ReorderChange[];
};
