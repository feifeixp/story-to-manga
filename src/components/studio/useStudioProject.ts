"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createProject, getCurrentProjectId, loadProjectData, saveProjectData, setCurrentProject } from "@/lib/projectStorage";
import { loadState } from "@/lib/storage";
import { DEFAULT_IMAGE_SIZE, type ProjectData, type ProjectMetadata, type ProjectStudioState } from "@/types/project";
export type StudioProject = ProjectData & {
  studio: ProjectStudioState;
};
export const defaultStudio = (): ProjectStudioState => ({
  aiModel: "auto",
  step: 1,
  approved: false,
  requestedPanelCount: 4,
  stalePanels: [],
  panelVersions: {}
});
export function blankProject(metadata: ProjectMetadata): StudioProject {
  return {
    metadata,
    story: "",
    style: metadata.style,
    imageSize: metadata.imageSize || DEFAULT_IMAGE_SIZE,
    storyAnalysis: null,
    storyBreakdown: null,
    characterReferences: [],
    generatedPanels: [],
    uploadedCharacterReferences: [],
    uploadedSettingReferences: [],
    studio: defaultStudio()
  };
}
function restore(project: ProjectData): StudioProject {
  const studio = {
    ...defaultStudio(),
    plannedStory: project.story,
    ...project.studio
  };
  if (!project.storyBreakdown) studio.step = 1;else if (studio.step > 2 && !project.generatedPanels.length) studio.step = 2;
  return {
    ...project,
    studio,
    ...(project.generationState ? {
      generationState: {
        ...project.generationState,
        isGenerating: false,
        isPaused: project.generationState.isGenerating || project.generationState.isPaused
      }
    } : {})
  };
}
export function useStudioProject() {
  const [project, setProject] = useState<StudioProject | null>(null);
  const current = useRef<StudioProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [storageError, setStorageError] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const snapshot = current.current;
    if (!snapshot) return;
    const version = revision.current;
    setSaveStatus("saving");
    const operation = queue.current.catch(() => {}).then(async () => {
      await saveProjectData(snapshot.metadata.id, snapshot.story, snapshot.style, snapshot.storyAnalysis, snapshot.storyBreakdown, snapshot.characterReferences, snapshot.generatedPanels, snapshot.uploadedCharacterReferences, snapshot.uploadedSettingReferences, snapshot.imageSize, snapshot.generationState, {
        studio: snapshot.studio,
        metadata: {
          name: snapshot.metadata.name,
          ...(snapshot.metadata.description ? {
            description: snapshot.metadata.description
          } : {})
        }
      });
      if (version === revision.current) {
        savedRevision.current = version;
        setSaveStatus("saved");
        setStorageError("");
      }
    });
    queue.current = operation;
    try {
      await operation;
    } catch (error) {
      setSaveStatus("error");
      setStorageError(error instanceof Error ? error.message : "无法保存 / Could not save");
      throw error;
    }
  }, []);
  const update = useCallback((change: (value: StudioProject) => StudioProject) => {
    if (!current.current) return;
    const next = change(current.current);
    if (next === current.current) return;
    current.current = next;
    revision.current += 1;
    setProject(next);
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save().catch(() => {});
    }, 400);
  }, [save]);
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const id = getCurrentProjectId();
        const existing = id ? await loadProjectData(id) : null;
        const legacy = !id ? await loadState() : null;
        if (!active) return;
        if (id && !existing) throw new Error("当前项目无法读取。请从项目列表选择其他项目；原数据未被覆盖。 / Current project could not be loaded; original data was not overwritten.");
        const next = existing ? restore(existing) : blankProject(createProject({
          name: legacy?.storyAnalysis?.title || "未命名作品 / Untitled",
          style: legacy?.style || "healing"
        }));
        if (legacy) Object.assign(next, legacy, {
          metadata: next.metadata,
          studio: {
            ...defaultStudio(),
            step: legacy.storyBreakdown ? 2 : 1,
            plannedStory: legacy.story
          }
        });
        current.current = next;
        setProject(next);
        if (legacy) {
          revision.current += 1;
          void save().catch(() => {});
        }
      } catch (error) {
        if (active) {
          setStorageError(error instanceof Error ? error.message : "无法读取项目 / Could not load project");
          setSaveStatus("error");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [save]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (revision.current !== savedRevision.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
      if (revision.current !== savedRevision.current) void save().catch(() => {});
    };
  }, [save]);
  const open = async (id: string) => {
    await save();
    setLoading(true);
    try {
      const value = await loadProjectData(id);
      if (!value) throw new Error("项目无法读取 / Could not load project");
      const next = restore(value);
      setCurrentProject(id);
      current.current = next;
      setProject(next);
      revision.current = 0;
      savedRevision.current = 0;
      setSaveStatus("saved");
      setStorageError("");
    } finally {
      setLoading(false);
    }
  };
  const create = async () => {
    await save();
    const next = blankProject(createProject({
      name: "未命名作品 / Untitled",
      style: "healing"
    }));
    current.current = next;
    setProject(next);
    revision.current = 0;
    savedRevision.current = 0;
    setSaveStatus("saved");
    setStorageError("");
  };
  return {
    project,
    current,
    update,
    save,
    open,
    create,
    loading,
    saveStatus,
    storageError
  };
}
