import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NetworkDataService } from '../../shared/services/network-data.service';
import { combineLatest, interval, map, Observable, Subject, Subscription, take, takeUntil, takeWhile } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TourComponent } from '../../shared/components/tour/tour.component';
import { TourService } from '../../shared/services/tour.service';

@Component({
   selector: 'app-playback-control',
   standalone: true,
   imports: [ AsyncPipe, FormsModule, NgIf, TourComponent ],
   templateUrl: './playback-control.component.html',
   styleUrl: './playback-control.component.scss'
})
export class PlaybackControlComponent implements OnInit, OnDestroy {
   private readonly unsubscribe = new Subject<void>();
   public readonly tourService = inject(TourService);
   public readonly networkDataService = inject(NetworkDataService);
   private animationSubscription!: Subscription;
   private currentFrame: number = 0;
   public playBackSpeed: number = 1;
   public isPlayingAnimation = false;

   public ngOnInit (): void {
      this.networkDataService.currentPointInTime$
         .pipe(takeUntil(this.unsubscribe))
         .subscribe(currentFrame => (this.currentFrame = currentFrame));
   }

   public readonly disablePreviousTimeStep$: Observable<boolean> = this.networkDataService.currentPointInTime$.pipe(
      takeUntil(this.unsubscribe),
      map(currentTime => currentTime - 1 < 0)
   );

   public readonly disableNextTimeStep$: Observable<boolean> = combineLatest([
      this.networkDataService.currentPointInTime$,
      this.networkDataService.projectSettings$
   ]).pipe(
      takeUntil(this.unsubscribe),
      map(([ currentTime, projectSettings ]) => currentTime + 1 >= projectSettings.totalFrames)
   );

   public playAnimation (): void {
      this.networkDataService.projectSettings$.pipe(take(1)).subscribe(projectSettings => {
         this.isPlayingAnimation = true;
         const timeBetweenFrames = projectSettings.totalAnimationDuration / projectSettings.totalFrames;

         this.animationSubscription = interval((timeBetweenFrames * 1000) / this.playBackSpeed)
            .pipe(
               takeWhile(() => {
                  const animationNotAtTheEnd = this.currentFrame < projectSettings.totalFrames - 1;
                  if (!animationNotAtTheEnd) {
                     this.isPlayingAnimation = false;
                  }
                  return animationNotAtTheEnd;
               })
            )
            .subscribe(() => {
               this.networkDataService.setTimePoint(this.currentFrame + 1);
            });
      });
   }

   public onPausePlayButtonClick (): void {
      if (this.isPlayingAnimation) {
         this.pauseAnimation();
      } else {
         this.playAnimation();
      }
   }

   public pauseAnimation (): void {
      this.animationSubscription?.unsubscribe();
      this.isPlayingAnimation = false;
   }

   public changePlayBackSpeed (): void {
      if (!this.isPlayingAnimation) {
         return;
      }
      this.animationSubscription?.unsubscribe();
      this.playAnimation();
   }

   public ngOnDestroy (): void {
      this.unsubscribe.next();
      this.unsubscribe.complete();
      this.animationSubscription?.unsubscribe();
   }
}
