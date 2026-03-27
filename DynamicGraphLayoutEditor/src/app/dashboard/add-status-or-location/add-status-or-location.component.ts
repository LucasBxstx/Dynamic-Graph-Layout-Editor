import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ColorPickerModule } from 'ngx-color-picker';
import { NetworkDataService } from '../../shared/services/network-data.service';

@Component({
   selector: 'app-add-status-or-location',
   standalone: true,
   imports: [ FormsModule, ColorPickerModule ],
   templateUrl: './add-status-or-location.component.html',
   styleUrl: './add-status-or-location.component.scss'
})
export class AddStatusOrLocationComponent implements OnInit {
   private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);
   private readonly networkDataService = inject(NetworkDataService);

   public context!: 'status' | 'location';

   public name: string = '';
   public color: string = '';

   public ngOnInit (): void {
      switch (this.route.routeConfig?.path) {
         case 'add-status':
            this.context = 'status';
            break;
         case 'add-location':
            this.context = 'location';
            break;
         default:
            this.closeWindow();
      }
   }

   public closeWindow (): void {
      this.router.navigate([ { outlets: { modal: null } } ], { relativeTo: this.route.parent });
   }

   public add (): void {
      if (this.context === 'status') {
         this.networkDataService.addStatus(this.name, this.color);
      } else if (this.context === 'location') {
         this.networkDataService.addLocation(this.name, this.color);
      }
      this.closeWindow();
   }
}
