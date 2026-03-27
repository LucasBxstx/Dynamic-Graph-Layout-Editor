import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EditOptionsService } from '../../shared/services/edit-options.service';
import { FormsModule } from '@angular/forms';
import { NetworkDataService } from '../../shared/services/network-data.service';

@Component({
   selector: 'app-add-node',
   standalone: true,
   imports: [ FormsModule ],
   templateUrl: './add-node.component.html',
   styleUrl: './add-node.component.scss'
})
export class AddNodeComponent {
   private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);
   public readonly editOptionsService = inject(EditOptionsService);
   private readonly networkDataService = inject(NetworkDataService);

   public editingName: string = '';

   public closeWindow (): void {
      this.router.navigate([ { outlets: { modal: null } } ], { relativeTo: this.route.parent });
   }

   public addNode (): void {
      // We need to deactivate all Options, because in the network-graph we can only use one event listener at the same time
      this.editOptionsService.deactivateAllEditOptions();

      this.networkDataService.addNodeToWaitingList({
         name: this.editingName
      });

      this.closeWindow();
   }
}
