import { Component, Input } from '@angular/core';
import { AnsiUp } from 'ansi_up';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'tskmgr-run-details-task-log',
  templateUrl: './run-details-task-log.component.html',
  styleUrl: './run-details-task-log.component.scss',
})
export class RunDetailsTaskLogComponent {
  // @Input() logFile: string;

  // assuming taskLog is your console output
  taskLogHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {
    this.convertAnsiToHtml('');
  }

  private convertAnsiToHtml(ansiText: string): void {
    ansiText =
      '\n\n\x1B[1;33;40m 33;40  \x1B[1;33;41m 33;41  \x1B[1;33;42m 33;42  \x1B[1;33;43m 33;43  \x1B[1;33;44m 33;44  \x1B[1;33;45m 33;45  \x1B[1;33;46m 33;46  \x1B[1m\x1B[0\n\n\x1B[1;33;42m >> Tests OK\n\n';

    const ansiConverter = new AnsiUp();
    const rawHtml = ansiConverter.ansi_to_html(ansiText);
    this.taskLogHtml = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }
}
