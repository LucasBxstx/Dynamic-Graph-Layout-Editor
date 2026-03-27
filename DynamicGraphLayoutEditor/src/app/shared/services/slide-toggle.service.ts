import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
   providedIn: 'root'
})
export class SlideToggleService {
   private readonly showNodeNames = new BehaviorSubject<boolean>(false);
   public readonly showNodeNames$ = this.showNodeNames.asObservable();

   private readonly hideNodesWithoutContact = new BehaviorSubject<boolean>(false);
   public readonly hideNodesWithoutContact$ = this.hideNodesWithoutContact.asObservable();

   private readonly showInitialLayout = new BehaviorSubject<boolean>(false);
   public readonly showInitialLayout$ = this.showInitialLayout.asObservable();

   private readonly colorNodesAndLinksByLocation = new BehaviorSubject<boolean>(false);
   public readonly colorNodesAndLinksByLocation$ = this.colorNodesAndLinksByLocation.asObservable();

   private readonly showNodeTrajectory = new BehaviorSubject<boolean>(false);
   public readonly showNodeTrajectory$ = this.showNodeTrajectory.asObservable();

   private readonly showLinkTrajectory = new BehaviorSubject<boolean>(false);
   public readonly showLinkTrajectory$ = this.showLinkTrajectory.asObservable();

   public onToggleShowNodeNames (): void {
      const value = this.showNodeNames.getValue();
      this.showNodeNames.next(!value);
   }

   public onToggleHideNodesWithoutContact (): void {
      const value = this.hideNodesWithoutContact.getValue();
      this.hideNodesWithoutContact.next(!value);
   }

   public onToggleShowInitialLayout (): void {
      const value = this.showInitialLayout.getValue();
      this.showInitialLayout.next(!value);
   }

   public onToggleColorNodesAndLinksByLocation (): void {
      const value = this.colorNodesAndLinksByLocation.getValue();
      this.colorNodesAndLinksByLocation.next(!value);
   }

   public onToggleShowNodeTrajectory (): void {
      const value = this.showNodeTrajectory.getValue();
      if (value) {
         this.showLinkTrajectory.next(false);
      }
      this.showNodeTrajectory.next(!value);
   }

   public onToggleShowLinkTrajectory (): void {
      const value = this.showLinkTrajectory.getValue();
      this.showLinkTrajectory.next(!value);
   }

   public setAllTogglesToDefault (): void {
      this.showNodeNames.next(false);
      this.hideNodesWithoutContact.next(false);
      this.showInitialLayout.next(false);
      this.colorNodesAndLinksByLocation.next(false);
      this.showNodeTrajectory.next(false);
      this.showLinkTrajectory.next(false);
   }
}
