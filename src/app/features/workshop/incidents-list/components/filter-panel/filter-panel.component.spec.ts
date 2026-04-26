import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterPanelComponent, FilterCounts } from './filter-panel.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('FilterPanelComponent', () => {
  let component: FilterPanelComponent;
  let fixture: ComponentFixture<FilterPanelComponent>;

  const mockCounts: FilterCounts = {
    todos: 25,
    pendientes: 10,
    asignadas: 8,
    en_proceso: 5,
    resueltas: 2
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FilterPanelComponent);
    component = fixture.componentInstance;
    
    // Set required inputs
    fixture.componentRef.setInput('counts', mockCounts);
    fixture.componentRef.setInput('activeFilter', 'todos');
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all filter buttons', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.filter-button'));
    expect(buttons.length).toBe(5);
  });

  it('should display correct counts for each filter', () => {
    const badges = fixture.debugElement.queryAll(By.css('.count-badge'));
    
    expect(badges[0].nativeElement.textContent.trim()).toBe('25'); // todos
    expect(badges[1].nativeElement.textContent.trim()).toBe('10'); // pendientes
    expect(badges[2].nativeElement.textContent.trim()).toBe('8');  // asignadas
    expect(badges[3].nativeElement.textContent.trim()).toBe('5');  // en_proceso
    expect(badges[4].nativeElement.textContent.trim()).toBe('2');  // resueltas
  });

  it('should apply active class to active filter', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.filter-button'));
    
    expect(buttons[0].nativeElement.classList.contains('active')).toBe(true);
    expect(buttons[1].nativeElement.classList.contains('active')).toBe(false);
  });

  it('should emit filterChange when filter button is clicked', () => {
    let emittedFilter: string | undefined;
    
    component.filterChange.subscribe((filter) => {
      emittedFilter = filter;
    });

    const buttons = fixture.debugElement.queryAll(By.css('.filter-button'));
    buttons[1].nativeElement.click(); // Click "Pendientes"

    expect(emittedFilter).toBe('pendientes');
  });

  it('should update active state when activeFilter input changes', () => {
    fixture.componentRef.setInput('activeFilter', 'pendientes');
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('.filter-button'));
    
    expect(buttons[0].nativeElement.classList.contains('active')).toBe(false);
    expect(buttons[1].nativeElement.classList.contains('active')).toBe(true);
  });

  it('should display correct filter labels', () => {
    const labels = fixture.debugElement.queryAll(By.css('.filter-label'));
    
    expect(labels[0].nativeElement.textContent.trim()).toBe('Todos');
    expect(labels[1].nativeElement.textContent.trim()).toBe('Pendientes');
    expect(labels[2].nativeElement.textContent.trim()).toBe('Asignadas');
    expect(labels[3].nativeElement.textContent.trim()).toBe('En Proceso');
    expect(labels[4].nativeElement.textContent.trim()).toBe('Resueltas');
  });

  it('should have proper accessibility attributes', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.filter-button'));
    
    buttons.forEach(button => {
      expect(button.nativeElement.getAttribute('aria-label')).toBeTruthy();
      expect(button.nativeElement.getAttribute('type')).toBe('button');
    });
  });
});
