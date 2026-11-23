export type ActivityResult = { status: number; body: object };

export function activityResponse(body: object, { status = 200 }: { status?: number } = {}): ActivityResult {
  return { body, status };
}
