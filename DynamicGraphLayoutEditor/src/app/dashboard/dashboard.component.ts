import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NetworkDataService } from '../shared/services/network-data.service';
import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { NetworkGraphComponent } from './network-graph/network-graph.component';
import { PlaybackControlComponent } from './playback-control/playback-control.component';
import { FileMenuComponent } from './file-menu/file-menu.component';
import { EditOptionsComponent } from './edit-options/edit-options.component';
import { TimelineComponent } from './timeline/timeline.component';
import { map, Observable, Subject, take } from 'rxjs';
import { EditOptionsService } from '../shared/services/edit-options.service';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { KeyframeLineComponent } from './keyframe-line/keyframe-line.component';
import { KeyframeBlockLineComponent } from './keyframe-block-line/keyframe-block-line.component';
import { ToggleMenuComponent } from './toggle-menu/toggle-menu.component';
import { LegendComponent, LegendData } from './legend/legend.component';
import { SlideToggleService } from '../shared/services/slide-toggle.service';
import { EventLineComponent } from './event-line/event-line.component';
import { TourService } from '../shared/services/tour.service';
import { TourComponent } from '../shared/components/tour/tour.component';

@Component({
   selector: 'app-dashboard',
   standalone: true,
   imports: [
      AsyncPipe,
      NetworkGraphComponent,
      NgIf,
      PlaybackControlComponent,
      FileMenuComponent,
      EditOptionsComponent,
      TimelineComponent,
      RouterOutlet,
      NgClass,
      KeyframeLineComponent,
      KeyframeBlockLineComponent,
      ToggleMenuComponent,
      LegendComponent,
      EventLineComponent,
      TourComponent
   ],
   templateUrl: './dashboard.component.html',
   styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
   private readonly unsubscribe = new Subject<void>();
   private readonly router = inject(Router);
   public readonly networkDataService = inject(NetworkDataService);
   public readonly editOptionsService = inject(EditOptionsService);
   public readonly slideToggleService = inject(SlideToggleService);
   public readonly tourService = inject(TourService);

   public isModalActive = false;

   public readonly statusLegendData$: Observable<LegendData[]> = this.networkDataService.networkData$.pipe(
      map(networkData =>
         networkData.states.map(state => ({
            name: state.name,
            color: state.color
         }))
      )
   );

   public readonly locationLegendData$: Observable<LegendData[]> = this.networkDataService.networkData$.pipe(
      map(networkData =>
         networkData.locations.map(location => ({
            name: location.name,
            color: location.color
         }))
      )
   );

   public ngOnInit (): void {
      const isFirstAppUse = localStorage.getItem('isFirstAppUse') === 'true';
      if (isFirstAppUse) {
         this.tourService.startTour();
         localStorage.setItem('isFirstAppUse', 'false');
      }

      this.networkDataService.setTimePoint(0); // To ensure that the first keyframe is selected
      this.editOptionsService.deactivateAllEditOptions();

      this.networkDataService.currentNetworkGraphData$.pipe(take(1)).subscribe(networkData => {
         if (!networkData) {
            this.router.navigate([ 'landing' ]);
         }
      });
   }

   public ngOnDestroy (): void {
      this.unsubscribe.next();
      this.unsubscribe.complete();
   }

   public onModalOpen (): void {
      this.isModalActive = true;
      document.body.style.overflow = 'hidden'; // Prevent background scroll
   }

   public onModalClose (): void {
      this.isModalActive = false;
      document.body.style.overflow = ''; // Re-enable scroll
   }
}
