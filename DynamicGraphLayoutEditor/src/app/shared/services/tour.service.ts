import { Injectable } from '@angular/core';
import { Stage, TourStage } from '../models/tour';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Injectable({
   providedIn: 'root'
})
export class TourService {
   public currentIndex: BehaviorSubject<number> = new BehaviorSubject<number>(0);
   public currentStage$: Observable<Stage> = this.currentIndex.pipe(
      map(index => this.stages.find(stage => stage.order === index)!.stage)
   );
   public isLastStage$: Observable<boolean> = this.currentIndex.pipe(map(index => index === this.stages.length - 1));

   public stages: TourStage[] = [
      { order: 0, stage: 'none' },
      { order: 1, stage: 'network-graph' },
      { order: 2, stage: 'playback-control' },
      { order: 3, stage: 'file-menu' },
      { order: 4, stage: 'legend-health-states' },
      { order: 5, stage: 'legend-locations' },
      { order: 6, stage: 'event-lines' },
      { order: 7, stage: 'toggle-menu' },
      { order: 8, stage: 'edit-options' }
   ];

   public startTour (): void {
      this.currentIndex.next(1);
   }

   public nextTourElement (): void {
      const currentIndex = this.currentIndex.getValue();
      const max = this.stages.length;
      const nextIndex = currentIndex + 1 >= max ? 0 : currentIndex + 1;
      this.currentIndex.next(nextIndex);
   }

   public previourTourElement (): void {
      const currentIndex = this.currentIndex.getValue();
      const min = 1;
      const previousIndex = currentIndex - 1 <= min ? min : currentIndex - 1;
      this.currentIndex.next(previousIndex);
   }

   public stopTour (): void {
      this.currentIndex.next(0);
   }
}
