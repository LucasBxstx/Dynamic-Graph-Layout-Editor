import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NetworkDataService } from '../../shared/services/network-data.service';
import { map } from 'rxjs/operators';
import { DynamicNetworkData } from '../../shared/models/network-data';
import { AsyncPipe, NgClass, NgFor, NgIf, NgStyle } from '@angular/common';

@Component({
   selector: 'app-select-location-or-status',
   standalone: true,
   imports: [ AsyncPipe, NgFor, NgStyle, NgClass, NgIf ],
   templateUrl: './select-location-or-status.html',
   styleUrl: './select-location-or-status.scss'
})
export class SelectLocationOrStatusComponent implements OnInit {
   private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);
   private readonly networkDataService = inject(NetworkDataService);

   public context!: 'select-location' | 'select-status';
   public selectedLocationId?: number;
   public selectedStatusId?: number;

   public readonly locations$ = this.networkDataService.networkData$.pipe(
      map((networkData: DynamicNetworkData) => networkData.locations)
   );

   public readonly states$ = this.networkDataService.networkData$.pipe(
      map((networkData: DynamicNetworkData) => networkData.states)
   );

   public ngOnInit (): void {
      switch (this.route.routeConfig?.path) {
         case 'select-location':
            this.context = 'select-location';
            break;
         case 'select-status':
            this.context = 'select-status';
            break;
         default:
            this.closeWindow();
      }
   }

   public setNewLocation (): void {
      if (!this.selectedLocationId) {
         return;
      }
      this.networkDataService.setNewLinkLocation(this.selectedLocationId);
      this.closeWindow();
   }

   public addNewStatus (): void {
      if (!this.selectedStatusId) {
         return;
      }
      this.networkDataService.addNodeStatusKeyframeBlock(this.selectedStatusId);
      this.closeWindow();
   }

   public closeWindow (): void {
      this.router.navigate([ { outlets: { modal: null } } ], { relativeTo: this.route.parent });
   }
}
