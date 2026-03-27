import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NetworkDataService } from '../../shared/services/network-data.service';
import { combineLatest, take } from 'rxjs';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-delete-objects',
  standalone: true,
  imports: [NgIf],
  templateUrl: './delete-objects.component.html',
  styleUrl: './delete-objects.component.scss',
})
export class DeleteObjectsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly networkDataService = inject(NetworkDataService);

  public question1?: string;
  public question2?: string;

  public ngOnInit(): void {
    combineLatest([
      this.networkDataService.selectedNodeIds$,
      this.networkDataService.selectedLinkIds$,
      this.networkDataService.affectedLinkIds$,
    ])
      .pipe(take(1))
      .subscribe(([selectedNodes, selectedLinks, affectedLinks]) => {
        const countNodes = selectedNodes.length;
        const countLinks = selectedLinks.length;
        const countAffectedLinks = affectedLinks.length;

        this.question1 = 'Do you really want to delete ';
        if (countNodes > 0) {
          this.question1 +=
            countNodes === 1
              ? 'the selectedNode'
              : `the ${countNodes} selected Nodes`;
        }

        if (countNodes > 0 && countLinks > 0) {
          this.question1 += ' and ';
        }

        if (countLinks > 0) {
          this.question1 +=
            countLinks === 1
              ? 'the selected Link'
              : `the ${countLinks} selected Links`;
        }

        this.question1 += '?';

        if (countAffectedLinks > 0) {
          if (countNodes === 1 && countAffectedLinks === 1) {
            this.question2 = `By deleting the selected Node, you will also delete one Link that is connected to this Node`;
          } else if (countNodes === 1 && countAffectedLinks > 1) {
            this.question2 = `By deleting the selected Node, you will also delete ${countAffectedLinks} Links that are connected to this Node`;
          } else if (countNodes > 1 && countAffectedLinks === 1) {
            this.question2 = `By deleting the ${countNodes} selected Nodes, you will also delete one Link that is connected to some of these Nodes`;
          } else {
            this.question2 = `By deleting the ${countNodes} selected Nodes, you will also delete ${countAffectedLinks} Links that are connected to these Nodes`;
          }
        }
      });
  }

  public closeWindow(): void {
    this.router.navigate([{ outlets: { modal: null } }], {
      relativeTo: this.route.parent,
    });
  }

  public deleteObjects(): void {
    this.networkDataService.deleteSelectedObjects();
    this.closeWindow();
  }
}
