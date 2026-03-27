import { Component, inject } from '@angular/core';
import { EditOptionsService } from '../../shared/services/edit-options.service';
import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { NetworkDataService } from '../../shared/services/network-data.service';
import { combineLatest, map, Observable, take } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TooltipComponent } from '../../shared/components/tooltip/tooltip.component';
import { TourService } from '../../shared/services/tour.service';
import { TourComponent } from '../../shared/components/tour/tour.component';

@Component({
   selector: 'app-edit-options',
   standalone: true,
   imports: [ NgClass, AsyncPipe, TooltipComponent, NgIf, TourComponent ],
   templateUrl: './edit-options.component.html',
   styleUrl: './edit-options.component.scss'
})
export class EditOptionsComponent {
   public readonly editOptionsServices = inject(EditOptionsService);
   public readonly networkDataService = inject(NetworkDataService);
   public readonly tourService = inject(TourService);
   private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);

   public readonly disableAddKeyframeButton$: Observable<boolean> = combineLatest([
      this.editOptionsServices.editingMode$,
      this.networkDataService.selectedNodeIds$,
      this.networkDataService.selectedLinkIds$
   ]).pipe(
      map(([ editingMode, selectedNodeIds, selectedLinkIds ]) => {
         if (editingMode === 'nothing') {
            return true;
         }

         if (editingMode === 'change-link-location') {
            return selectedLinkIds.length === 0;
         }

         if (editingMode === 'move-node' || editingMode === 'edit-node-health-state') {
            return selectedNodeIds.length === 0;
         }

         return true;
      })
   );

   public readonly disableDeleteKeyframeButton$: Observable<boolean> = combineLatest([
      this.editOptionsServices.editingMode$,
      this.networkDataService.selectedNodeIds$,
      this.networkDataService.selectedLinkIds$,
      this.networkDataService.currentSelectedEditingKeyFrames$,
      this.networkDataService.currentSelectedKeyframeBlocks$
   ]).pipe(
      map(([ editingMode, selectedNodeIds, selectedLinkIds, selectedKeyframes, selectedKeyframeBlocks ]) => {
         if (editingMode === 'nothing') {
            return true;
         }

         if (editingMode === 'change-link-location') {
            if (selectedLinkIds.length === 1 && selectedKeyframeBlocks.length !== 0) {
               return false;
            }
            return true;
         }

         if (editingMode === 'move-node') {
            if (selectedNodeIds.length > 0 && selectedKeyframes.length !== 0) {
               return false;
            }
            return true;
         }

         if (editingMode === 'edit-node-health-state') {
            if (selectedNodeIds.length > 0 && selectedKeyframeBlocks.length !== 0) {
               return false;
            }
            return true;
         }

         return true;
      })
   );

   public readonly disableDeleteObjects$: Observable<boolean> = combineLatest([
      this.networkDataService.selectedNodeIds$,
      this.networkDataService.selectedLinkIds$
   ]).pipe(map(([ selectedNodes, selectedLinks ]) => selectedNodes.length === 0 && selectedLinks.length === 0));

   public addNode (): void {
      this.router.navigate([ { outlets: { modal: [ 'add-node' ] } } ], {
         relativeTo: this.route
      });
   }

   public editLinkLocation (): void {
      this.router.navigate([ { outlets: { modal: [ 'select-location' ] } } ], {
         relativeTo: this.route
      });
      this.editOptionsServices.setEditingMode('nothing');
   }

   public deleteObjects (): void {
      this.router.navigate([ { outlets: { modal: [ 'delete-objects' ] } } ], {
         relativeTo: this.route
      });
   }

   public addKeyframe (): void {
      this.editOptionsServices.editingMode$.pipe(take(1)).subscribe(editingMode => {
         if (editingMode === 'move-node') {
            this.networkDataService.addPositionKeyFrameAtCurrentTimePoint();
         } else if (editingMode === 'edit-node-health-state') {
            this.selectStatusForKeyframeBlock();
         }
      });
   }

   private selectStatusForKeyframeBlock (): void {
      this.router.navigate([ { outlets: { modal: [ 'select-status' ] } } ], {
         relativeTo: this.route
      });
   }

   public addLink (): void {
      this.networkDataService.addLink();
      this.editOptionsServices.setEditingMode('change-link-duration');
   }

   public deleteKeyframes (): void {
      this.editOptionsServices.editingMode$.pipe(take(1)).subscribe(editingMode => {
         if (editingMode === 'move-node') {
            this.networkDataService.deleteSelectedPositionKeyFrames();
         } else if (editingMode === 'edit-node-health-state') {
            this.networkDataService.deleteSelectedKeyframeBlocks();
         }
      });
   }
}
