import { BaseSequencer, type TestSpecification } from "vite-plus/test/node";

export class CheckTestSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]) {
    const ordered = await super.sort(files);
    // Windows Git process tests form the critical path; start them before UI projects.
    return ordered.toSorted(
      (a, b) =>
        a.project.config.sequence.groupOrder - b.project.config.sequence.groupOrder ||
        Number(b.project.name === "t3") - Number(a.project.name === "t3"),
    );
  }
}
