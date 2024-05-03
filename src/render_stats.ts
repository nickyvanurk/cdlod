// eslint-disable-next-line
// @ts-ignore
import Stats from 'three/examples/jsm/libs/stats.module';

export class RenderStats {
  domElement = document.createElement('div');

  private readonly stats = new Stats();
  private readonly panels: Stats.Panel[] = [];

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.domElement.id = 'render-stats';

    this.stats.domElement.style.position = 'absolute';
    this.stats.domElement.style.display = 'flex';
    this.stats.domElement.style.flexDirection = 'column';
    this.domElement.appendChild(this.stats.domElement);

    const msPanel = Stats.Panel('Delta', '#0f0', '#020');
    this.stats.addPanel(msPanel);
    this.panels.push(msPanel);

    const callsPanel = Stats.Panel('Draw Calls', '#ff0', '#220');
    this.stats.addPanel(callsPanel);
    this.panels.push(callsPanel);

    const programsPanel = Stats.Panel('Programs', '#ff0', '#220');
    this.stats.addPanel(programsPanel);
    this.panels.push(programsPanel);

    const geometriesPanel = Stats.Panel('Geometries', '#ff0', '#220');
    this.stats.addPanel(geometriesPanel);
    this.panels.push(geometriesPanel);

    const pointsPanel = Stats.Panel('Points', '#f08', '#201');
    this.stats.addPanel(pointsPanel);
    this.panels.push(pointsPanel);

    const linesPanel = Stats.Panel('Lines', '#f08', '#201');
    this.stats.addPanel(linesPanel);
    this.panels.push(linesPanel);

    const trisPanel = Stats.Panel('Tris', '#f08', '#201');
    this.stats.addPanel(trisPanel);
    this.panels.push(trisPanel);
  }

  update(dt: number) {
    this.stats.update();
    this.panels[0]?.update(dt, 200);
    this.panels[1]?.update(this.renderer.info.render.calls, 2);
    this.panels[2]?.update(this.renderer.info.programs?.length || 0, 10);
    this.panels[3]?.update(this.renderer.info.memory.geometries, 2);
    this.panels[4]?.update(this.renderer.info.render.points, 200000);
    this.panels[5]?.update(this.renderer.info.render.lines, 200000);
    this.panels[6]?.update(this.renderer.info.render.triangles, 200000);
  }
}
