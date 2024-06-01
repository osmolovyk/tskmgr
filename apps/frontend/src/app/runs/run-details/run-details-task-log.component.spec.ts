import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RunDetailsTaskLogComponent } from './run-details-task-log.component';

describe('RunDetailsTaskLogComponent', () => {
  let component: RunDetailsTaskLogComponent;
  let fixture: ComponentFixture<RunDetailsTaskLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RunDetailsTaskLogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RunDetailsTaskLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
