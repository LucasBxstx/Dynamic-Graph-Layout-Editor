import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { EditingMode, SelectionMode } from '../models/edit-options';
import { NetworkDataService } from './network-data.service';

@Injectable({
   providedIn: 'root'
})
export class EditOptionsService {
   private readonly networkDataService = inject(NetworkDataService);
   private readonly selectionMode = new BehaviorSubject<SelectionMode>('nothing');
   public readonly selectionMode$ = this.selectionMode.asObservable();

   private readonly editingMode = new BehaviorSubject<EditingMode>('nothing');
   public readonly editingMode$ = this.editingMode.asObservable();

   public onClickSelectObjects (): void {
      const value = this.selectionMode.getValue();
      this.selectionMode.next(value === 'objects' ? 'nothing' : 'objects');
   }

   public onClickSelectNodes (): void {
      const value = this.selectionMode.getValue();
      this.selectionMode.next(value === 'nodes' ? 'nothing' : 'nodes');
   }

   public onClickSelectLinks (): void {
      const value = this.selectionMode.getValue();
      this.selectionMode.next(value === 'links' ? 'nothing' : 'links');
   }

   public onClickMoveNodes (): void {
      const value = this.editingMode.getValue();
      this.setEditingMode(value === 'move-node' ? 'nothing' : 'move-node');
   }

   public onClickChangeLinkDuration (): void {
      const value = this.editingMode.getValue();
      this.setEditingMode(value === 'change-link-duration' ? 'nothing' : 'change-link-duration');
   }

   public onClickEditNodeHealthState (): void {
      const value = this.editingMode.getValue();
      this.setEditingMode(value === 'edit-node-health-state' ? 'nothing' : 'edit-node-health-state');
   }

   public setEditingMode (editingMode: EditingMode): void {
      this.editingMode.next(editingMode);
      this.networkDataService.resetAllSelectedKeyframes();
   }

   public deactivateAllEditOptions (): void {
      this.selectionMode.next('nothing');
      this.editingMode.next('nothing');
   }
}
