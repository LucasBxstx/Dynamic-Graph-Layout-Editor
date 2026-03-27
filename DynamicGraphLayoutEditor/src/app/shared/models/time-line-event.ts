export type TimeLineEventType = 'status' | 'contact' | 'location';

export interface EventPoint {
   id: number;
   frame: number;
   referenceId: number;
}
