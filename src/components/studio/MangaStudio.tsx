"use client";

import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Check,
	CheckCircle2,
	Download,
	FileText,
	FolderOpen,
	ImagePlus,
	LayoutGrid,
	Link2,
	Loader2,
	Pause,
	Pencil,
	Plus,
	RefreshCw,
	Settings2,
	ShieldCheck,
	Sparkles,
	Upload,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/components/I18nProvider";
import ImageUpload from "@/components/ImageUpload";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ShareComicModal } from "@/components/ShareComicModal";
import {
	type ComicLayout,
	comicLayout,
	panelComposition,
	panelImageSize,
} from "@/lib/comicLayout";
import {
	defaultProjectStorage,
	type ProjectStorage,
} from "@/lib/projectStorage";
import { STORY_PREVIEWS, STYLE_PREVIEWS } from "@/lib/studioArtwork";
import {
	downloadImage,
	downloadProject,
	exportComicPages,
	exportPanels,
} from "@/lib/studioExport";
import {
	generatePendingPanels,
	pendingPanels,
	requestStudioApi,
	type StudioStep,
	upsertPanel,
	validateBreakdown,
} from "@/lib/studioWorkflow";
import type {
	CharacterReference,
	ComicStyle,
	GeneratedPanel,
	StoryAnalysis,
	StoryBreakdown,
} from "@/types";
import type { ProjectListItem } from "@/types/project";
import { ComicLayoutChoices, ComicPageComposer } from "./ComicPageComposer";
import { StudioDialog } from "./StudioDialog";
import {
	defaultStudio,
	type StudioProject,
	useStudioProject,
} from "./useStudioProject";

const SAMPLE =
	"小满在雨巷深处经营一家旧书店。一个下雨的傍晚，一只橘猫叼着一封没有署名的信，蹲在她的店门前。\n\n信上只有一句话：‘雨停之前，来巷子的尽头。’小满撑起那把旧绿伞，跟着橘猫走进了细雨里。\n\n巷子尽头，一只生锈的邮筒旁站着多年未见的奶奶。原来，这封信是奶奶年轻时写给未来的约定。\n\n雨渐渐停了。小满把伞往奶奶那边倾了倾，橘猫轻轻跳进她们的臂弯。回家的路，忽然变得很短。";
const STYLES: Array<{
	id: ComicStyle;
	zh: string;
	en: string;
	detail: string;
}> = [
	{
		id: "healing",
		zh: "日系治愈",
		en: "Gentle slice of life",
		detail: "柔和 · 日常",
	},
	{
		id: "manga",
		zh: "黑白漫画",
		en: "Japanese manga",
		detail: "线条 · 张力",
	},
	{
		id: "wuxia",
		zh: "东方水墨",
		en: "Chinese wuxia",
		detail: "留白 · 意境",
	},
	{
		id: "comic",
		zh: "复古美漫",
		en: "American comic",
		detail: "色彩 · 力量",
	},
	{
		id: "manhwa",
		zh: "韩式条漫",
		en: "Korean manhwa",
		detail: "清新 · 细腻",
	},
	{
		id: "cinematic",
		zh: "电影叙事",
		en: "Cinematic",
		detail: "光影 · 镜头",
	},
	{
		id: "shojo",
		zh: "少女漫画",
		en: "Shojo",
		detail: "浪漫 · 轻盈",
	},
	{
		id: "seinen",
		zh: "青年漫画",
		en: "Seinen",
		detail: "写实 · 深度",
	},
	{
		id: "chibi",
		zh: "Q版萌系",
		en: "Chibi",
		detail: "圆润 · 可爱",
	},
	{
		id: "fantasy",
		zh: "奇幻冒险",
		en: "Fantasy",
		detail: "想象 · 世界",
	},
];
type Dialog =
	| "new"
	| "sample"
	| "analyze"
	| "generate"
	| "projects"
	| "export"
	| "help"
	| "versions"
	| "share"
	| null;
type Panel = StoryBreakdown["panels"][number];
export default function MangaStudio({
	deployment = "next",
	imageModels = [],
	modelNotice = "",
	defaultImageModelLabel = "Neo Image 2.5",
	previewImage = STORY_PREVIEWS.inspiration,
	projectStorage = defaultProjectStorage,
}: {
	deployment?: "next" | "neowow";
	imageModels?: { id: string; name: string }[];
	modelNotice?: string;
	defaultImageModelLabel?: string;
	previewImage?: string;
	projectStorage?: ProjectStorage;
} = {}) {
	const market = deployment === "neowow";
	const fieldPrefix = useId();
	const { language } = useI18n();
	const router = useRouter();
	const zh = language.startsWith("zh");
	const copy = (cn: string, en: string) => (zh ? cn : en);
	const { user } = useAuth();
	const store = useStudioProject(projectStorage);
	const { project, current, update, save, loading, saveStatus, storageError } =
		store;
	const [busy, setBusy] = useState(false);
	const busyRef = useRef(false);
	const pause = useRef(false);
	const controller = useRef<AbortController | null>(null);
	const [pauseRequested, setPauseRequested] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [dialog, setDialog] = useState<Dialog>(null);
	const [authOpen, setAuthOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const shareAfterLogin = useRef(false);
	const [selected, setSelected] = useState(0);
	const [panelPage, setPanelPage] = useState(0);
	const [projects, setProjects] = useState<ProjectListItem[]>([]);
	const [editingCharacter, setEditingCharacter] = useState<number | null>(null);
	const [characterDraft, setCharacterDraft] = useState({
		name: "",
		physicalDescription: "",
		personality: "",
		role: "",
	});
	const [modifyPrompt, setModifyPrompt] = useState("");
	const [failed, setFailed] = useState<number[]>([]);
	const [preview, setPreview] = useState<string | null>(null);
	const [view, setView] = useState<"page" | "panels">("page");
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			pause.current = true;
		};
	}, []);
	useEffect(() => {
		if (user && shareAfterLogin.current) {
			shareAfterLogin.current = false;
			setAuthOpen(false);
			setShareOpen(true);
		}
	}, [user]);
	const projectId = project?.metadata.id;
	useEffect(() => {
		if (projectId) {
			setSelected(0);
			setPanelPage(0);
			setFailed([]);
			setModifyPrompt("");
		}
	}, [projectId]);
	useEffect(() => {
		if (!busy) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [busy]);
	async function run(action: () => Promise<void>) {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		setError("");
		pause.current = false;
		setPauseRequested(false);
		controller.current = new AbortController();
		try {
			await action();
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: copy("操作失败，请重试。", "Something went wrong. Please retry."),
			);
		} finally {
			busyRef.current = false;
			setBusy(false);
			setStatus("");
			controller.current = null;
			setPauseRequested(false);
		}
	}
	function patch(values: Partial<StudioProject>) {
		update((value) => ({
			...value,
			...values,
		}));
	}
	function navigate(step: StudioStep) {
		if (busyRef.current) return;
		update((value) => ({
			...value,
			studio: {
				...value.studio,
				step,
			},
		}));
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	}
	function markAllStale(value: StudioProject) {
		return {
			...value.studio,
			approved: false,
			stalePanels: value.generatedPanels.map((panel) => panel.panelNumber),
		};
	}
	function changeComicLayout(layout: ComicLayout) {
		update((value) => ({
			...value,
			studio: { ...value.studio, comicLayout: layout },
		}));
	}
	async function analyze() {
		setDialog(null);
		await run(async () => {
			const snapshot = current.current;
			if (!snapshot?.story.trim()) return;
			await save();
			setStatus(copy("正在理解你的故事…", "Reading your story…"));
			const { analysis } = await requestStudioApi<{
				analysis: StoryAnalysis;
			}>(
				"/api/analyze-story",
				{
					story: snapshot.story,
					style: snapshot.style,
					language,
				},
				controller.current?.signal,
			);
			if (
				!analysis?.title ||
				!Array.isArray(analysis.characters) ||
				!analysis.setting ||
				!Array.isArray(analysis.scenes)
			)
				throw new Error(
					copy(
						"故事分析格式无效，请重试。",
						"The story analysis was invalid. Please retry.",
					),
				);
			if (!mounted.current) return;
			setStatus(copy("正在安排镜头与对白…", "Planning panels and dialogue…"));
			const { storyBreakdown } = await requestStudioApi<{
				storyBreakdown: StoryBreakdown;
			}>(
				"/api/chunk-story",
				{
					story: snapshot.story,
					characters: analysis.characters,
					setting: analysis.setting,
					scenes: analysis.scenes,
					style: snapshot.style,
					language,
					panelCount: snapshot.studio.requestedPanelCount,
					panelComposition: Array.from(
						{ length: snapshot.studio.requestedPanelCount },
						(_, i) => ({
							panelNumber: i + 1,
							aspectRatio: panelImageSize(
								{ ...snapshot, storyBreakdown: null, generatedPanels: [] },
								i + 1,
							).aspectRatio,
						}),
					),
				},
				controller.current?.signal,
			);
			const breakdown = validateBreakdown(storyBreakdown);
			// Replace only after both calls succeed. An interrupted re-plan keeps the old project intact.
			update((value) => ({
				...value,
				storyAnalysis: analysis,
				storyBreakdown: breakdown,
				characterReferences: [],
				generatedPanels: [],
				metadata: {
					...value.metadata,
					name: value.metadata.name.startsWith("未命名")
						? analysis.title
						: value.metadata.name,
				},
				studio: {
					...value.studio,
					step: 2,
					approved: false,
					plannedStory: snapshot.story,
					stalePanels: [],
					panelVersions: {},
				},
			}));
			setSelected(0);
			setPanelPage(0);
			setFailed([]);
			await save();
		});
	}
	async function generate() {
		setDialog(null);
		await run(async () => {
			const snapshot = current.current;
			if (!snapshot?.storyAnalysis || !snapshot.storyBreakdown) return;
			if (snapshot.studio.plannedStory !== snapshot.story)
				throw new Error(
					copy(
						"故事内容已改变，请先回到第一步重新拆解。",
						"Your story changed. Return to step one and re-plan first.",
					),
				);
			validateBreakdown(snapshot.storyBreakdown);
			const analysis = snapshot.storyAnalysis;
			update((value) => ({
				...value,
				studio: {
					...value.studio,
					step: 3,
					approved: true,
				},
			}));
			await save();
			let references = snapshot.characterReferences;
			const missingCharacters = analysis.characters.filter(
				(character) =>
					!references.some(
						(reference) => reference.name === character.name && reference.image,
					),
			);
			for (const character of missingCharacters) {
				if (pause.current) return;
				setStatus(
					copy("正在绘制角色参考图…", "Creating character reference images…"),
				);
				const result = await requestStudioApi<{
					characterReferences: CharacterReference[];
				}>(
					"/api/generate-character-refs",
					{
						characters: [character],
						setting: analysis.setting,
						style: snapshot.style,
						uploadedCharacterReferences: snapshot.uploadedCharacterReferences,
						language,
						aiModel: snapshot.studio.aiModel,
					},
					controller.current?.signal,
				);
				if (!Array.isArray(result.characterReferences))
					throw new Error(
						copy(
							"未收到角色参考图。",
							"No character reference images received.",
						),
					);
				references = [
					...references.filter(
						(reference) =>
							!result.characterReferences.some(
								(item) => item.name === reference.name,
							),
					),
					...result.characterReferences.filter((reference) => reference.image),
				];
				patch({
					characterReferences: references,
				});
				await save();
				if (
					!references.some(
						(reference) => reference.name === character.name && reference.image,
					)
				)
					throw new Error(
						copy(
							"部分角色未完成。已保存成功的参考图，请继续生成。",
							"Some character references failed. Saved completed images; continue to retry missing ones.",
						),
					);
			}
			await generatePendingPanels({
				breakdown: snapshot.storyBreakdown,
				generated: snapshot.generatedPanels,
				stale: snapshot.studio.stalePanels,
				shouldPause: () => pause.current,
				generate: async (panel) => {
					setStatus(
						copy(
							`正在绘制第 ${panel.panelNumber} 格…`,
							`Drawing panel ${panel.panelNumber}…`,
						),
					);
					const result = await requestStudioApi<{
						generatedPanel: GeneratedPanel;
					}>(
						"/api/generate-panel",
						{
							panel,
							characterReferences: references,
							setting: analysis.setting,
							scenes: analysis.scenes,
							style: snapshot.style,
							uploadedSettingReferences: snapshot.uploadedSettingReferences,
							language,
							aiModel: snapshot.studio.aiModel,
							imageSize: panelImageSize(snapshot, panel.panelNumber),
							composition: panelComposition(snapshot),
						},
						controller.current?.signal,
					);
					return {
						...result.generatedPanel,
						composition: panelComposition(snapshot),
					};
				},
				onPanel: async (panel) => {
					retainPanel(panel);
					setFailed((list) =>
						list.filter((number) => number !== panel.panelNumber),
					);
					await save();
				},
				onFailure: (number, cause) => {
					setFailed((list) => [...new Set([...list, number])]);
					setError(
						cause instanceof Error
							? cause.message
							: copy(
									"生成失败，请继续重试。",
									"Generation failed. Continue to retry.",
								),
					);
				},
			});
			await save();
		});
	}
	function retainPanel(panel: GeneratedPanel) {
		update((value) => {
			const previous = value.generatedPanels.find(
				(item) => item.panelNumber === panel.panelNumber,
			);
			const versions = value.studio.panelVersions || {};
			return {
				...value,
				generatedPanels: upsertPanel(value.generatedPanels, panel),
				studio: {
					...value.studio,
					stalePanels: value.studio.stalePanels.filter(
						(number) => number !== panel.panelNumber,
					),
					panelVersions: {
						...versions,
						[panel.panelNumber]: previous
							? [...(versions[panel.panelNumber] || []), previous].slice(-3)
							: versions[panel.panelNumber] || [],
					},
				},
			};
		});
	}
	function editPanel(number: number, changes: Partial<Panel>) {
		update((value) => ({
			...value,
			storyBreakdown: value.storyBreakdown
				? {
						panels: value.storyBreakdown.panels.map((panel) =>
							panel.panelNumber === number
								? {
										...panel,
										...changes,
									}
								: panel,
						),
					}
				: null,
			studio: {
				...value.studio,
				approved: false,
				stalePanels: value.generatedPanels.some(
					(panel) => panel.panelNumber === number,
				)
					? [...new Set([...value.studio.stalePanels, number])]
					: value.studio.stalePanels,
			},
		}));
	}
	async function redraw(modify: boolean, recompose = false) {
		await run(async () => {
			const snapshot = current.current;
			const panel = snapshot?.storyBreakdown?.panels[selected];
			if (!snapshot || !panel?.sceneDescription.trim()) return;
			if (
				snapshot.studio.plannedStory !== snapshot.story ||
				snapshot.storyAnalysis?.characters.some(
					(character) =>
						!snapshot.characterReferences.some(
							(reference) =>
								reference.name === character.name && reference.image,
						),
				)
			)
				throw new Error(
					copy(
						"故事或角色设定已改变，请先回到分镜审核，再继续生成。",
						"Story or character direction has changed. Review the storyboard and continue generation first.",
					),
				);
			const old = snapshot.generatedPanels.find(
				(item) => item.panelNumber === panel.panelNumber,
			);
			if ((modify || recompose) && !old) return;
			if (modify && !recompose && !modifyPrompt.trim()) return;
			const composition = recompose
				? "japanese"
				: modify
					? old?.composition || "single"
					: panelComposition(snapshot);
			setStatus(
				copy(
					`正在${recompose ? "重排" : modify ? "修改" : "重绘"}第 ${panel.panelNumber} 格…`,
					`Refining panel ${panel.panelNumber}…`,
				),
			);
			const originalPrompt = [
				panel.sceneDescription,
				`Camera: ${panel.cameraAngle}`,
				`Mood: ${panel.visualMood}`,
				`Dialogue: ${panel.dialogue || ""}`,
			].join("\n");
			const result = await requestStudioApi<{
				imageData: string;
			}>(
				modify || recompose ? "/api/modify-image" : "/api/redraw-image",
				{
					imageType: "panel",
					imageId: panel.panelNumber,
					originalPrompt,
					...(modify || recompose
						? {
								originalImage: old?.image,
								modificationPrompt: recompose
									? "Recompose this artwork into Japanese manga insets."
									: modifyPrompt,
								recompose,
							}
						: {}),
					referenceImages: [
						...snapshot.characterReferences
							.filter((reference) => panel.characters.includes(reference.name))
							.map((reference) => reference.image),
						...snapshot.uploadedSettingReferences.map(
							(reference) => reference.image,
						),
					].slice(0, 4),
					language,
					aiModel: snapshot.studio.aiModel,
					imageSize: panelImageSize(snapshot, panel.panelNumber),
					composition,
					style: snapshot.style,
				},
				controller.current?.signal,
			);
			retainPanel({
				panelNumber: panel.panelNumber,
				image: result.imageData,
				composition,
			});
			await save();
			setModifyPrompt("");
		});
	}
	function saveCharacter() {
		const index = editingCharacter;
		if (
			index === null ||
			!characterDraft.name.trim() ||
			!characterDraft.physicalDescription.trim()
		)
			return;
		update((value) => {
			const previous = value.storyAnalysis?.characters[index];
			if (!previous || !value.storyAnalysis) return value;
			const name = characterDraft.name.trim();
			if (
				value.storyAnalysis.characters.some(
					(character, position) =>
						position !== index && character.name === name,
				)
			) {
				setError(copy("角色名字不能重复。", "Character names must be unique."));
				return value;
			}
			return {
				...value,
				storyAnalysis: {
					...value.storyAnalysis,
					characters: value.storyAnalysis.characters.map(
						(character, position) =>
							position === index
								? {
										...characterDraft,
										name,
									}
								: character,
					),
				},
				characterReferences: value.characterReferences.filter(
					(reference) => reference.name !== previous.name,
				),
				storyBreakdown: value.storyBreakdown
					? {
							panels: value.storyBreakdown.panels.map((panel) => ({
								...panel,
								characters: panel.characters.map((character) =>
									character === previous.name ? name : character,
								),
							})),
						}
					: null,
				studio: markAllStale(value),
			};
		});
		setEditingCharacter(null);
	}
	async function showProjects() {
		await run(async () => {
			await save();
			setProjects(projectStorage.getProjectList());
			setDialog("projects");
		});
	}
	function share() {
		if (!market) {
			setDialog("share");
			return;
		}
		if (user) setShareOpen(true);
		else {
			shareAfterLogin.current = true;
			setAuthOpen(true);
		}
	}
	if (loading)
		return (
			<main className="studio-loading">
				<Loader2 className="spin" />
				<p>
					{copy("正在打开你的创作工作台…", "Opening your creative workspace…")}
				</p>
			</main>
		);
	if (!project)
		return (
			<main className="studio-loading">
				<h1>
					{copy("暂时无法读取本地项目", "Unable to open your local project")}
				</h1>
				<p role="alert">{storageError}</p>
				<button
					type="button"
					className="studio-btn primary"
					onClick={() => {
						setProjects(projectStorage.getProjectList());
						setDialog("projects");
					}}
				>
					{copy("查看项目", "View projects")}
				</button>
				{dialog === "projects" && (
					<StudioDialog
						title={copy("我的项目", "My projects")}
						onClose={() => setDialog(null)}
					>
						{projects.map((item) => (
							<button
								type="button"
								className="project-row"
								key={item.metadata.id}
								onClick={() =>
									void run(async () => {
										await store.open(item.metadata.id);
										setDialog(null);
									})
								}
							>
								{item.metadata.name}
							</button>
						))}
					</StudioDialog>
				)}
			</main>
		);
	const step = project.studio.step;
	const panels = project.storyBreakdown?.panels || [];
	const activePanel = panels[selected];
	const pending = pendingPanels(
		project.storyBreakdown,
		project.generatedPanels,
		project.studio.stalePanels,
	);
	const complete = panels.length > 0 && pending.length === 0;
	const planChanged =
		!!panels.length && project.studio.plannedStory !== project.story;
	const completedCount = panels.length - pending.length;
	const generatedActive = project.generatedPanels.find(
		(panel) => panel.panelNumber === activePanel?.panelNumber,
	);
	const visiblePanels = panels.slice(panelPage * 12, panelPage * 12 + 12);
	const maxPage = Math.max(0, Math.ceil(panels.length / 12) - 1);
	const styleLabel = STYLES.find((style) => style.id === project.style);
	const names = zh
		? ["写下故事", "确认角色与分镜", "生成漫画", "精修与导出"]
		: [
				"Write your story",
				"Review the storyboard",
				"Create your manga",
				"Refine & export",
			];
	const subtitles = zh
		? ["把灵感写下来", "让画面先有章法", "把想象变成画面", "打磨每一格细节"]
		: [
				"Start with an idea",
				"Plan before you draw",
				"Bring it to life",
				"Make every frame yours",
			];
	const headings = zh
		? [
				"每一格，都从一个好故事开始。",
				"先让故事，在脑海里放映。",
				complete ? "你的故事，有画面了。" : "故事正在一点点变成画面。",
				"好故事，值得再打磨一格。",
			]
		: [
				"Every frame starts with a good story.",
				"Give your story a little direction.",
				complete
					? "Your story has come to life."
					: "One frame closer to your imagination.",
				"Good stories deserve a final touch.",
			];
	const descriptions = zh
		? [
				"写下一个想法、一段回忆，或是一个尚未说完的故事。",
				"看看角色、镜头与对白。确认满意后，再开始绘制。",
				"完成的画面会保留。暂停后，可以从未完成的那一格继续。",
				"选中画面，改一句对白，换一个镜头。其他分镜会留在原处。",
			]
		: [
				"An idea, a memory, or a story you have not quite finished telling.",
				"Review characters, camera angles, and dialogue before creating images.",
				"Completed frames are kept. Pause and continue from where you left off.",
				"Choose a frame, edit its direction, and refine it without starting over.",
			];
	function board(panel: Panel, index: number, showArt: boolean) {
		const image = project?.generatedPanels.find(
			(item) => item.panelNumber === panel.panelNumber,
		);
		const stale = project?.studio.stalePanels.includes(panel.panelNumber);
		return (
			<button
				type="button"
				key={panel.panelNumber}
				className={`board-card ${selected === index ? "selected" : ""}`}
				onClick={() => {
					if (!busy) {
						setSelected(index);
						setModifyPrompt("");
					}
				}}
				disabled={busy}
				aria-pressed={selected === index}
			>
				<div className="board-art">
					{showArt && image ? (
						<img
							src={image.image}
							alt={copy(
								`第 ${panel.panelNumber} 格`,
								`Panel ${panel.panelNumber}`,
							)}
							loading="lazy"
						/>
					) : (
						<div className={`sketch-placeholder sketch-${index % 4}`}>
							<LayoutGrid size={30} />
							<span>
								{showArt
									? copy("等待绘制", "Waiting to draw")
									: panel.cameraAngle}
							</span>
						</div>
					)}
					<span className="panel-badge">
						{String(panel.panelNumber).padStart(2, "0")}
					</span>
					{stale && (
						<span className="stale-label">
							{copy("待重绘", "Needs redraw")}
						</span>
					)}
					{failed.includes(panel.panelNumber) && (
						<span className="stale-label error-label">
							{copy("未完成", "Failed")}
						</span>
					)}
				</div>
				<div className="board-copy">
					<strong>{panel.cameraAngle || copy("分镜", "Panel")}</strong>
					<p>{panel.sceneDescription}</p>
					<span>
						{panel.dialogue ||
							copy("无对白 · 让画面说话", "No dialogue · let the image speak")}
					</span>
				</div>
			</button>
		);
	}
	const pager = maxPage > 0 && (
		<nav
			className="studio-pagination"
			aria-label={copy("分镜分页", "Panel pages")}
		>
			<button
				type="button"
				className="studio-btn"
				disabled={panelPage === 0 || busy}
				onClick={() => setPanelPage((page) => page - 1)}
			>
				<ArrowLeft size={16} />
				{copy("上一页", "Previous")}
			</button>
			<span>
				{panelPage + 1} / {maxPage + 1}
			</span>
			<button
				type="button"
				className="studio-btn"
				disabled={panelPage === maxPage || busy}
				onClick={() => setPanelPage((page) => page + 1)}
			>
				{copy("下一页", "Next")}
				<ArrowRight size={16} />
			</button>
		</nav>
	);
	const inspector = activePanel && (
		<aside className="studio-inspector studio-card">
			<div className="inspector-heading">
				<div>
					<span className="eyebrow">
						FRAME {String(activePanel.panelNumber).padStart(2, "0")}
					</span>
					<h2>{copy("把这一格说清楚", "Direct this frame")}</h2>
				</div>
				<Pencil size={18} />
			</div>
			<fieldset disabled={busy} className="studio-fields">
				<label>
					{copy("画面描述", "Scene description")}
					<textarea
						value={activePanel.sceneDescription}
						rows={5}
						maxLength={2500}
						onChange={(event) =>
							editPanel(activePanel.panelNumber, {
								sceneDescription: event.target.value,
							})
						}
					/>
				</label>
				<label>
					{copy("对白 / 旁白", "Dialogue / narration")}
					<textarea
						value={activePanel.dialogue || ""}
						rows={3}
						maxLength={1200}
						onChange={(event) =>
							editPanel(activePanel.panelNumber, {
								dialogue: event.target.value,
							})
						}
					/>
				</label>
				<div className="field-pair">
					<label>
						{copy("镜头", "Camera")}
						<input
							value={activePanel.cameraAngle}
							onChange={(event) =>
								editPanel(activePanel.panelNumber, {
									cameraAngle: event.target.value,
								})
							}
						/>
					</label>
					<label>
						{copy("氛围", "Mood")}
						<input
							value={activePanel.visualMood}
							onChange={(event) =>
								editPanel(activePanel.panelNumber, {
									visualMood: event.target.value,
								})
							}
						/>
					</label>
				</div>
				<label>
					{copy("场景", "Setting")}
					<select
						value={activePanel.sceneId}
						onChange={(event) =>
							editPanel(activePanel.panelNumber, {
								sceneId: event.target.value,
							})
						}
					>
						{project.storyAnalysis?.scenes.map((scene) => (
							<option key={scene.id} value={scene.id}>
								{scene.name}
							</option>
						))}
					</select>
				</label>
				<div className="character-checks">
					<span>{copy("出场角色", "Characters in frame")}</span>
					{project.storyAnalysis?.characters.map((character) => (
						<label key={character.name}>
							<input
								type="checkbox"
								checked={activePanel.characters.includes(character.name)}
								onChange={(event) =>
									editPanel(activePanel.panelNumber, {
										characters: event.target.checked
											? [...activePanel.characters, character.name]
											: activePanel.characters.filter(
													(name) => name !== character.name,
												),
									})
								}
							/>
							{character.name}
						</label>
					))}
				</div>
			</fieldset>
			<p className="muted micro">
				{copy(
					"改动自动保存。已生成画面会标记为待重绘，旧图仍会保留。",
					"Edits are saved automatically. Existing images stay available until you redraw.",
				)}
			</p>
			{step === 4 && (
				<div className="refine-actions">
					<button
						type="button"
						className="studio-btn primary full"
						disabled={busy || !activePanel.sceneDescription.trim()}
						onClick={() => void redraw(false)}
					>
						<RefreshCw size={16} />
						{copy("只重绘这一格", "Redraw this frame")}
					</button>
					{generatedActive && (
						<>
							<button
								type="button"
								className="studio-btn full"
								disabled={busy || !activePanel.sceneDescription.trim()}
								onClick={() => void redraw(true, true)}
							>
								<Sparkles size={16} />
								{copy("日漫重排这一格", "Recompose with manga insets")}
							</button>
							<p className="field-hint">
								{copy(
									"用当前图片重新生成主画面与特写小格，会消耗生成额度。原图保留在历史版本中。",
									"Regenerates the current artwork with a main scene and detail insets. Uses generation credits; the original stays in version history.",
								)}
							</p>
							<label>
								{copy("或者，描述想修改的细节", "Or describe a small change")}
								<textarea
									rows={2}
									value={modifyPrompt}
									disabled={busy}
									onChange={(event) => setModifyPrompt(event.target.value)}
									placeholder={copy(
										"例如：让光线再温暖一点",
										"For example: make the lighting warmer",
									)}
								/>
							</label>
							<button
								type="button"
								className="studio-btn full"
								disabled={busy || !modifyPrompt.trim()}
								onClick={() => void redraw(true)}
							>
								<Sparkles size={16} />
								{copy("修改当前画面", "Edit current image")}
							</button>
							<div className="field-pair">
								<button
									type="button"
									className="studio-btn"
									disabled={busy}
									onClick={() => setPreview(generatedActive.image)}
								>
									{copy("查看大图", "Preview")}
								</button>
								<button
									type="button"
									className="studio-btn"
									disabled={busy}
									onClick={() =>
										void run(async () =>
											downloadImage(
												generatedActive.image,
												`panel-${activePanel.panelNumber}`,
											),
										)
									}
								>
									<Download size={14} />
									{copy("下载", "Download")}
								</button>
							</div>
						</>
					)}
					<button
						type="button"
						className="studio-text-link"
						disabled={
							busy ||
							!project.studio.panelVersions?.[activePanel.panelNumber]?.length
						}
						onClick={() => setDialog("versions")}
					>
						{copy("查看上一版", "Previous versions")}
					</button>
					<p className="muted micro">
						{copy(
							"重绘与修改会调用已配置的模型，可能产生费用。",
							"Redraw and edit use your configured model and may incur charges.",
						)}
					</p>
				</div>
			)}
		</aside>
	);
	return (
		<div className="manga-studio" lang={zh ? "zh-CN" : "en"}>
			<header className="studio-topbar">
				<div className="studio-top-left">
					<Link
						className="studio-brand"
						href="/"
						aria-disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							if (!busyRef.current)
								void run(async () => {
									await save();
									router.push("/");
								});
						}}
					>
						<span className="brand-icon">
							<BookOpen size={22} />
						</span>
						Story to Manga
					</Link>
					<span className="top-divider" />
					<span className="top-location">
						{copy("创作工作台", "Creative studio")}
					</span>
				</div>
				<div className="studio-top-actions">
					<Link
						href={market ? "/about" : "/comics"}
						className="studio-text-link gallery-link"
						aria-disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							if (!busyRef.current)
								void run(async () => {
									await save();
									router.push(market ? "/about" : "/comics");
								});
						}}
					>
						{market
							? copy("使用说明与源码", "Guide & source")
							: copy("作品画廊", "Gallery")}
					</Link>
					<LanguageSwitcher />
					<button
						type="button"
						className="studio-icon mobile-projects"
						aria-label={copy("我的项目", "My projects")}
						disabled={busy}
						onClick={() => void showProjects()}
					>
						<FolderOpen size={18} />
					</button>
					<button
						type="button"
						className="studio-btn small"
						aria-label={copy("新建作品", "New story")}
						disabled={busy}
						onClick={() => setDialog("new")}
					>
						<Plus size={16} />
						<span>{copy("新建作品", "New story")}</span>
					</button>
					<button
						type="button"
						className={market ? "studio-avatar" : "studio-neo-account"}
						onClick={() => setAuthOpen(true)}
						aria-label={
							market
								? user
									? copy("账户", "Account")
									: copy("登录 NeoWoW", "Sign in to NeoWoW")
								: copy("关联 NeoWoW", "Connect NeoWoW")
						}
					>
						{market ? (
							user?.name?.slice(0, 1) || <UserRound size={18} />
						) : (
							<>
								<Link2 size={16} />
								<span>NeoWoW</span>
							</>
						)}
					</button>
				</div>
			</header>
			<div className="studio-layout">
				<aside className="studio-rail">
					<div>
						<p className="project-label">
							{copy("当前作品", "CURRENT PROJECT")} / PROJECT
						</p>
						<button
							type="button"
							className="project-tile"
							onClick={() => void showProjects()}
							disabled={busy}
						>
							<span className="project-book">
								<BookOpen size={23} />
							</span>
							<span>
								<strong>{project.metadata.name}</strong>
								<small>
									{copy("本地草稿", "Local draft")} ·{" "}
									{zh ? styleLabel?.zh : styleLabel?.en}
								</small>
							</span>
							<FolderOpen size={16} />
						</button>
						<nav
							className="studio-steps"
							aria-label={copy("创作步骤", "Creation steps")}
						>
							{names.map((name, index) => {
								const number = (index + 1) as StudioStep;
								const enabled =
									number === 1 ||
									(number === 2 && panels.length > 0) ||
									(number === 3 && project.studio.approved) ||
									(number === 4 && project.generatedPanels.length > 0);
								return (
									<button
										type="button"
										key={name}
										className={`studio-step ${step === number ? "active" : ""} ${step > number ? "done" : ""}`}
										onClick={() => navigate(number)}
										disabled={busy || !enabled}
										aria-current={step === number ? "step" : undefined}
									>
										<span className="step-number">
											{step > number ? <Check size={16} /> : number}
										</span>
										<span>
											<strong>{name}</strong>
											<small>{subtitles[index]}</small>
										</span>
										{step === number && <span className="active-step-dot" />}
									</button>
								);
							})}
						</nav>
						<button
							type="button"
							className="studio-text-link rail-projects"
							disabled={busy}
							onClick={() => void showProjects()}
						>
							<FolderOpen size={16} />
							{copy("我的项目", "My projects")}
						</button>
					</div>
					<div className="rail-bottom">
						<output
							className={`save-indicator ${saveStatus === "error" ? "save-error" : ""}`}
						>
							<span className="status-dot" />
							{saveStatus === "saved"
								? copy("已保存到此浏览器", "Saved in this browser")
								: saveStatus === "saving"
									? copy("正在保存…", "Saving…")
									: copy("尚未保存，请备份", "Not saved. Export a backup")}
						</output>
						<p>
							{copy(
								"灵感不用一口气完成。\n下次回来，接着画。",
								"Great stories take a little time.\nCome back and keep creating.",
							)}
						</p>
						<button
							type="button"
							className="studio-text-link"
							onClick={() => setDialog("help")}
						>
							{copy("使用说明与模型配置", "Help & model setup")}
							<ArrowRight size={14} />
						</button>
					</div>
				</aside>
				<main className="studio-main">
					<div className="studio-content">
						<div className="page-title">
							<div className="eyebrow">
								CHAPTER 0{step} /{" "}
								{
									[
										"THE STORY",
										"THE DIRECTION",
										"MAKE IT REAL",
										"THE FINAL TOUCH",
									][step - 1]
								}
							</div>
							<h1>{headings[step - 1]}</h1>
							<p>{descriptions[step - 1]}</p>
						</div>
						{(error || storageError) && (
							<div className="studio-alert" role="alert">
								<strong>
									{copy("需要留意一下", "Something needs attention")}
								</strong>
								<p>{error || storageError}</p>
								{storageError && (
									<div className="studio-row">
										<button
											type="button"
											className="studio-btn small"
											onClick={() => downloadProject(project)}
										>
											{copy("导出项目备份", "Export a backup")}
										</button>
										<button
											type="button"
											className="studio-btn small"
											disabled={busy}
											onClick={() => void run(save)}
										>
											{copy("重试保存", "Retry saving")}
										</button>
									</div>
								)}
							</div>
						)}
						{planChanged && step > 1 && (
							<div className="studio-alert" role="alert">
								{copy(
									"故事文字已改变。请返回第一步重新拆解，避免用旧分镜生成。已完成图片仍保留，可以导出备份。",
									"Your story text changed. Return to step one and re-plan before generating. Existing images are kept and can be backed up.",
								)}
							</div>
						)}
						{busy && (
							<output className="studio-busy" aria-live="polite">
								<Loader2 size={18} className="spin" />
								{status || copy("正在处理…", "Working…")}
								{pauseRequested && (
									<span>
										{copy("本次请求完成后暂停", "Pausing after this request")}
									</span>
								)}
							</output>
						)}
						{step === 1 && (
							<div className="story-layout">
								<div>
									<section className="studio-card story-editor">
										<div className="section-top">
											<h2>
												<Pencil size={18} />
												{copy("你的故事", "Your story")}
											</h2>
											<button
												type="button"
												className="studio-text-link"
												disabled={busy}
												onClick={() => setDialog("sample")}
											>
												{copy("试试示例", "Try a sample")}
												<ArrowRight size={14} />
											</button>
										</div>
										<label className="sr-only" htmlFor={`${fieldPrefix}-title`}>
											{copy("作品标题", "Story title")}
										</label>
										<input
											id={`${fieldPrefix}-title`}
											className="story-title-input"
											value={
												project.metadata.name.startsWith("未命名")
													? ""
													: project.metadata.name
											}
											disabled={busy}
											maxLength={80}
											placeholder={copy(
												"为你的故事起个名字",
												"Give your story a name",
											)}
											onChange={(event) =>
												patch({
													metadata: {
														...project.metadata,
														name: event.target.value || "未命名作品 / Untitled",
													},
												})
											}
										/>
										<label className="sr-only" htmlFor={`${fieldPrefix}-story`}>
											{copy("故事内容", "Story text")}
										</label>
										<textarea
											id={`${fieldPrefix}-story`}
											className="story-textarea"
											disabled={busy}
											value={project.story}
											maxLength={5000}
											placeholder={copy(
												"主角是谁？故事发生在哪里？\n试着从一个特别的瞬间开始……",
												"Who is the main character? Where does it happen?\nTry starting with one memorable moment…",
											)}
											onChange={(event) =>
												update((value) => ({
													...value,
													story: event.target.value,
													studio: {
														...value.studio,
														approved: false,
													},
												}))
											}
										/>
										<div className="story-editor-footer">
											<span>
												<FileText size={14} />
												{copy(
													"支持中文和英文",
													"Chinese and English supported",
												)}
											</span>
											<span>
												{Array.from(project.story).length.toLocaleString()} /
												5,000
											</span>
										</div>
									</section>
									<section className="studio-card style-picker">
										<div className="section-top">
											<h2>
												<Sparkles size={18} />
												{copy("给故事一种画风", "Find your visual style")}
											</h2>
											<span className="muted micro">
												{copy("可以稍后调整", "You can change this later")}
											</span>
										</div>
										<div className="style-grid">
											{STYLES.slice(0, 4).map((item) => (
												<button
													type="button"
													key={item.id}
													disabled={busy}
													className={`style-choice ${item.id === project.style ? "selected" : ""}`}
													onClick={() =>
														update((value) =>
															value.style === item.id
																? value
																: {
																		...value,
																		style: item.id,
																		studio: markAllStale(value),
																		characterReferences: [],
																	},
														)
													}
													aria-pressed={item.id === project.style}
												>
													<img
														className="style-preview"
														src={STYLE_PREVIEWS[item.id]}
														alt={copy(
															`${item.zh}画风示例：橘猫、绿伞与信封`,
															`${item.en} example: a cat, umbrella and letter`,
														)}
														width={480}
														height={320}
														decoding="async"
													/>
													<strong>{zh ? item.zh : item.en}</strong>
													<small>{zh ? item.detail : item.id}</small>
													{item.id === project.style && (
														<CheckCircle2 className="style-check" size={17} />
													)}
												</button>
											))}
										</div>
										<details className="more-styles">
											<summary>{copy("更多画风", "More styles")}</summary>
											<div className="style-grid more-style-grid">
												{STYLES.slice(4).map((item) => (
													<button
														type="button"
														className={`style-choice ${item.id === project.style ? "selected" : ""}`}
														aria-pressed={item.id === project.style}
														key={item.id}
														disabled={busy}
														onClick={() =>
															update((value) =>
																value.style === item.id
																	? value
																	: {
																			...value,
																			style: item.id,
																			studio: markAllStale(value),
																			characterReferences: [],
																		},
															)
														}
													>
														<img
															className="style-preview"
															src={STYLE_PREVIEWS[item.id]}
															alt={copy(
																`${item.zh}画风示例：橘猫、绿伞与信封`,
																`${item.en} example: a cat, umbrella and letter`,
															)}
															width={480}
															height={320}
															loading="lazy"
															decoding="async"
														/>
														<strong>{zh ? item.zh : item.en}</strong>
														<small>{zh ? item.detail : item.id}</small>
														{item.id === project.style && (
															<CheckCircle2 className="style-check" size={17} />
														)}
													</button>
												))}
											</div>
										</details>
									</section>
									<section className="studio-card reference-section">
										<details>
											<summary>
												<ImagePlus size={17} />
												{copy(
													"添加角色或场景参考图",
													"Add character or setting references",
												)}
												<span className="muted micro">
													{copy("可选", "Optional")}
												</span>
											</summary>
											<fieldset disabled={busy}>
												<ImageUpload
													title={copy("角色参考", "Character references")}
													description={copy(
														"使用角色名字命名，帮助保持人物一致。",
														"Name references after characters to help keep them consistent.",
													)}
													images={project.uploadedCharacterReferences}
													onImageAdd={(image) => {
														if (
															current.current?.metadata.id !==
																project.metadata.id ||
															busyRef.current
														) {
															setError(
																copy(
																	"参考图读取期间项目已切换或操作已开始，请稍后重新上传。",
																	"The project changed or a task started while reading your reference. Please upload it again.",
																),
															);
															return;
														}
														update((value) => ({
															...value,
															uploadedCharacterReferences: [
																...value.uploadedCharacterReferences,
																image,
															],
															characterReferences: [],
															studio: markAllStale(value),
														}));
													}}
													onImageRemove={(id) =>
														update((value) => ({
															...value,
															uploadedCharacterReferences:
																value.uploadedCharacterReferences.filter(
																	(image) => image.id !== id,
																),
															characterReferences: [],
															studio: markAllStale(value),
														}))
													}
													onImageNameChange={(id, name) =>
														update((value) => ({
															...value,
															uploadedCharacterReferences:
																value.uploadedCharacterReferences.map(
																	(image) =>
																		image.id === id
																			? {
																					...image,
																					name,
																				}
																			: image,
																),
															characterReferences: [],
															studio: markAllStale(value),
														}))
													}
												/>
												<ImageUpload
													title={copy("场景参考", "Setting references")}
													description={copy(
														"建筑、环境或色彩参考。",
														"References for locations, environment, or color.",
													)}
													images={project.uploadedSettingReferences}
													onImageAdd={(image) => {
														if (
															current.current?.metadata.id !==
																project.metadata.id ||
															busyRef.current
														) {
															setError(
																copy(
																	"参考图读取期间项目已切换或操作已开始，请稍后重新上传。",
																	"The project changed or a task started while reading your reference. Please upload it again.",
																),
															);
															return;
														}
														update((value) => ({
															...value,
															uploadedSettingReferences: [
																...value.uploadedSettingReferences,
																image,
															],
															studio: markAllStale(value),
														}));
													}}
													onImageRemove={(id) =>
														update((value) => ({
															...value,
															uploadedSettingReferences:
																value.uploadedSettingReferences.filter(
																	(image) => image.id !== id,
																),
															studio: markAllStale(value),
														}))
													}
													onImageNameChange={(id, name) =>
														update((value) => ({
															...value,
															uploadedSettingReferences:
																value.uploadedSettingReferences.map((image) =>
																	image.id === id
																		? {
																				...image,
																				name,
																			}
																		: image,
																),
															studio: markAllStale(value),
														}))
													}
												/>
											</fieldset>
										</details>
									</section>
								</div>
								<aside className="story-sidebar">
									<section className="studio-card settings-card">
										<h2>
											<Settings2 size={18} />
											{copy("创作设置", "Creative settings")}
										</h2>
										<fieldset disabled={busy}>
											<legend>{copy("分镜数量", "Number of panels")}</legend>
											<div className="count-choice">
												{[4, 6, 8, 12].map((count) => (
													<button
														type="button"
														key={count}
														className={
															project.studio.requestedPanelCount === count
																? "selected"
																: ""
														}
														aria-pressed={
															project.studio.requestedPanelCount === count
														}
														onClick={() =>
															update((value) => ({
																...value,
																studio: {
																	...value.studio,
																	requestedPanelCount: count,
																},
															}))
														}
													>
														{count}
														{zh ? " 格" : ""}
													</button>
												))}
											</div>
											<p className="muted micro">
												{copy(
													"这是规划目标，最终数量以分镜预览为准。",
													"A planning target. Review the actual count before generation.",
												)}
											</p>
											<div className="layout-setting">
												<span className="layout-setting-label">
													{copy("漫画排版", "Comic layout")}
												</span>
												<ComicLayoutChoices
													value={comicLayout(project)}
													onChange={changeComicLayout}
													zh={zh}
													disabled={busy}
												/>
												<p className="muted micro">
													{copy(
														"单格图片比例由排版自动安排，无需单独设置。",
														"The layout automatically defines each image’s aspect ratio.",
													)}
												</p>
											</div>
											<label htmlFor={`${fieldPrefix}-model`}>
												{copy("图像模型", "Image provider")}
											</label>
											<select
												id={`${fieldPrefix}-model`}
												value={
													market &&
													["nanobanana", "volcengine"].includes(
														project.studio.aiModel,
													)
														? "auto"
														: project.studio.aiModel
												}
												onChange={(event) =>
													update((value) => ({
														...value,
														studio: {
															...value.studio,
															aiModel: event.target.value,
														},
													}))
												}
											>
												<option value="auto">
													{market
														? copy(
																`默认 · ${defaultImageModelLabel}`,
																`Default · ${defaultImageModelLabel}`,
															)
														: copy("按本地配置选择", "Use local configuration")}
												</option>
												{market ? (
													imageModels.map((model) => (
														<option key={model.id} value={model.id}>
															{model.name}
														</option>
													))
												) : (
													<>
														<option value="nanobanana">Google Gemini</option>
														<option value="volcengine">
															{copy("火山引擎 Doubao", "Volcengine Doubao")}
														</option>
													</>
												)}
											</select>
											<p className="muted micro">
												{copy(
													market
														? modelNotice
														: "使用服务器已配置的模型。故事拆解由 Google 文本模型完成。",
													market
														? "Images prefer Neo Image 2.5 in every language; you can select another model. Text uses your Coding Plan and images use your credits."
														: "Uses server-configured providers. Story planning uses the Google text model.",
												)}
											</p>
										</fieldset>
									</section>
									<section className="inspiration-card">
										<div className="inspiration-art">
											<img
												src={previewImage}
												alt={copy(
													"AI 生成的画面示例：橘猫叼信，在绿伞下等待",
													"AI-generated example: a cat carrying a letter under a green umbrella",
												)}
											/>
										</div>
										<span className="eyebrow">A LITTLE INSPIRATION</span>
										<h3>
											{copy(
												"一个小瞬间，也能成为故事。",
												"A small moment can be a story.",
											)}
										</h3>
										<p>
											{copy(
												"一封来信、一把旧伞、一场意外的重逢。先写下来，画面会慢慢生长。",
												"A letter, an old umbrella, an unexpected reunion. Start with a moment.",
											)}
										</p>
										<small>
											{copy(
												"AI 生成示例，非当前故事的生成结果",
												"AI-generated example, not a result from your current story",
											)}
										</small>
									</section>
								</aside>
							</div>
						)}
						{step === 2 && (
							<>
								<section className="studio-card characters-section">
									<div className="section-top">
										<h2>
											<UserRound size={18} />
											{copy("故事里的人", "Meet your characters")}
										</h2>
										<span className="tag">
											{project.storyAnalysis?.characters.length || 0}{" "}
											{copy("位角色", "characters")}
										</span>
									</div>
									<div className="character-grid">
										{project.storyAnalysis?.characters.map(
											(character, index) => {
												const reference = project.characterReferences.find(
													(item) => item.name === character.name,
												);
												return (
													<div className="character-card" key={character.name}>
														<div className="character-avatar">
															{reference ? (
																<img
																	src={reference.image}
																	alt={character.name}
																/>
															) : (
																<UserRound size={30} />
															)}
														</div>
														<div>
															<h3>{character.name}</h3>
															<p>{character.physicalDescription}</p>
															<small>{character.role}</small>
														</div>
														<button
															type="button"
															className="studio-icon"
															aria-label={copy(
																`编辑${character.name}`,
																`Edit ${character.name}`,
															)}
															disabled={busy}
															onClick={() => {
																setEditingCharacter(index);
																setCharacterDraft({
																	...character,
																});
															}}
														>
															<Pencil size={16} />
														</button>
													</div>
												);
											},
										)}
									</div>
									<p className="muted micro">
										{copy(
											"确认生成后才会绘制角色参考图。",
											"Character reference images are drawn after you confirm generation.",
										)}
									</p>
								</section>
								<div className="section-top boards-heading">
									<h2>
										<LayoutGrid size={18} />
										{copy("分镜脚本", "Your storyboard")}
										<span className="tag">
											{panels.length} {copy("格", "frames")}
										</span>
									</h2>
									<span className="muted micro">
										{copy(
											"选中一格，调整镜头与对白",
											"Select a frame to edit its direction",
										)}
									</span>
								</div>
								<div className="review-layout">
									<div>
										<div className="boards-grid">
											{visiblePanels.map((panel, index) =>
												board(panel, panelPage * 12 + index, false),
											)}
										</div>
										{pager}
									</div>
									{inspector}
								</div>
							</>
						)}
						{step === 3 && (
							<>
								<section className="studio-card generation-card">
									<div className="section-top">
										<div className="generation-summary">
											<span className="generation-symbol">
												{complete ? (
													<CheckCircle2 size={24} />
												) : busy ? (
													<Loader2 className="spin" size={24} />
												) : (
													<Pause size={24} />
												)}
											</span>
											<div>
												<h2>
													{complete
														? copy("全部画面已就绪", "All frames are ready")
														: busy
															? copy("正在绘制你的漫画", "Creating your manga")
															: copy("随时可以接着画", "Ready when you are")}
												</h2>
												<p>
													{completedCount} / {panels.length}{" "}
													{copy("格完成", "frames ready")} ·{" "}
													{zh ? styleLabel?.zh : styleLabel?.en}
												</p>
											</div>
										</div>
										{!complete && (
											<button
												type="button"
												className="studio-btn"
												disabled={pauseRequested}
												onClick={() => {
													if (busy) {
														pause.current = true;
														setPauseRequested(true);
													} else setDialog("generate");
												}}
											>
												{busy ? <Pause size={16} /> : <RefreshCw size={16} />}
												{busy
													? copy("暂停", "Pause")
													: copy("继续生成", "Continue")}
											</button>
										)}
									</div>
									<progress
										max={panels.length || 1}
										value={completedCount}
										aria-label={copy("生成进度", "Generation progress")}
									/>
									<p className="muted micro">
										{copy(
											"暂停会等待当前请求结束，再停止发送新请求。离开页面不会取消服务器已开始的生成。",
											"Pause waits for the current request, then stops new requests. Leaving does not cancel work already started on the server.",
										)}
									</p>
								</section>
								<div className="boards-grid generation-boards">
									{visiblePanels.map((panel, index) =>
										board(panel, panelPage * 12 + index, true),
									)}
								</div>
								{pager}
							</>
						)}
						{step === 4 && (
							<div className="review-layout">
								<div>
									<div className="section-top canvas-top">
										<span className="muted">
											{panels.length} {copy("格短篇", "frames")} ·{" "}
											{zh ? styleLabel?.zh : styleLabel?.en}
										</span>
										<div className="view-switch">
											<button
												type="button"
												aria-pressed={view === "page"}
												className={view === "page" ? "selected" : ""}
												onClick={() => setView("page")}
											>
												{copy("漫画排版", "Comic pages")}
											</button>
											<button
												type="button"
												aria-pressed={view === "panels"}
												className={view === "panels" ? "selected" : ""}
												onClick={() => setView("panels")}
											>
												{copy("分镜", "Frames")}
											</button>
										</div>
									</div>
									{view === "page" ? (
										<ComicPageComposer
											key={project.metadata.id}
											project={project}
											zh={zh}
											disabled={busy}
											onLayout={changeComicLayout}
											onCaptions={(show) =>
												update((value) => ({
													...value,
													studio: { ...value.studio, comicCaptions: show },
												}))
											}
											onSelect={(number) => {
												setSelected(
													panels.findIndex(
														(panel) => panel.panelNumber === number,
													),
												);
												setModifyPrompt("");
											}}
										/>
									) : (
										<div className="boards-grid">
											{visiblePanels.map((panel, index) =>
												board(panel, panelPage * 12 + index, true),
											)}
										</div>
									)}
									{view === "panels" && pager}
									<div className="studio-tip">
										<ShieldCheck size={18} />
										<span>
											{copy(
												"每次重绘保留最近三次旧图，可以恢复。项目备份包含故事、参考图与历史图片。",
												"The latest three previous images are kept for each frame. Project backups include your story, references, and image history.",
											)}
										</span>
									</div>
								</div>
								{inspector}
							</div>
						)}
					</div>
					<footer className="studio-footer">
						<div>
							<strong>
								{step === 1
									? copy(
											"先拆解故事，再决定画面。",
											"Plan first. Draw when you are ready.",
										)
									: step === 2
										? copy(
												"你是导演，每一格都由你决定。",
												"You are the director of every frame.",
											)
										: step === 3
											? copy(
													`${completedCount} 格已完成，继续创作无需从头开始`,
													`${completedCount} frames are ready. Keep going without starting over.`,
												)
											: copy(
													"打磨完成，把故事带走。",
													"Make it yours. Take your story with you.",
												)}
							</strong>
							<small>
								{step === 1
									? copy(
											"接下来只规划角色和分镜，不生成图片",
											"Next: plan characters and panels; no images yet",
										)
									: step === 2
										? copy(
												"生成将调用真实模型，可能产生费用",
												"Generation calls real models and may incur charges",
											)
										: saveStatus === "saved"
											? copy(
													"已保存到此浏览器 · 建议定期导出备份",
													"Saved in this browser · export a backup regularly",
												)
											: copy(
													"请等待保存完成，或导出项目备份",
													"Wait for saving, or export a project backup",
												)}
							</small>
						</div>
						<div className="studio-row">
							{step > 1 && (
								<button
									type="button"
									className="studio-btn ghost"
									disabled={busy}
									onClick={() => navigate((step - 1) as StudioStep)}
								>
									<ArrowLeft size={16} />
									{copy("返回", "Back")}
								</button>
							)}
							{step === 1 && (
								<button
									type="button"
									className="studio-btn primary"
									disabled={busy || project.story.trim().length < 15}
									onClick={() =>
										panels.length ? setDialog("analyze") : void analyze()
									}
								>
									<Sparkles size={17} />
									{copy("拆解我的故事", "Plan my story")}
									<ArrowRight size={17} />
								</button>
							)}
							{step === 2 && (
								<button
									type="button"
									className="studio-btn primary"
									disabled={
										busy ||
										planChanged ||
										!panels.length ||
										panels.some((panel) => !panel.sceneDescription.trim())
									}
									onClick={() => setDialog("generate")}
								>
									{copy("确认分镜，开始生成", "Confirm & create")}
									<ArrowRight size={17} />
								</button>
							)}
							{step === 3 && (
								<button
									type="button"
									className="studio-btn primary"
									disabled={busy || !project.generatedPanels.length}
									onClick={() => navigate(4)}
								>
									{copy("进入精修与导出", "Refine & export")}
									<ArrowRight size={17} />
								</button>
							)}
							{step === 4 && (
								<>
									<button
										type="button"
										className="studio-btn ghost"
										disabled={busy}
										onClick={() => downloadProject(project)}
									>
										<FileText size={16} />
										{copy("导出项目", "Project backup")}
									</button>
									<button
										type="button"
										className="studio-btn primary"
										disabled={busy || !project.generatedPanels.length}
										onClick={() => setDialog("export")}
									>
										<Download size={17} />
										{copy("导出漫画", "Export manga")}
									</button>
								</>
							)}
						</div>
					</footer>
				</main>
			</div>
			{dialog && dialog !== "share" && (
				<StudioDialog
					className={dialog === "export" ? "comic-export-dialog" : ""}
					title={
						dialog === "projects"
							? copy("我的项目", "My projects")
							: dialog === "export"
								? copy("把故事带走", "Take your story with you")
								: dialog === "generate"
									? copy("确认这份分镜", "Confirm this storyboard")
									: dialog === "versions"
										? copy("这一格的历史图片", "Previous images of this frame")
										: dialog === "help"
											? copy(
													"欢迎来到创作工作台",
													"Welcome to your creative studio",
												)
											: dialog === "new"
												? copy("开始一个新故事", "Start a new story")
												: dialog === "sample"
													? copy("载入示例故事", "Load sample story")
													: copy("重新拆解故事", "Re-plan this story")
					}
					onClose={() => {
						if (!busy) setDialog(null);
					}}
				>
					{dialog === "new" && (
						<>
							<p>
								{copy(
									"当前作品会先保存。新故事将作为独立项目创建，你可以随时从“我的项目”回来。",
									"Your current story will be saved first. The new story becomes a separate project.",
								)}
							</p>
							<div className="dialog-actions">
								<button
									type="button"
									className="studio-btn"
									onClick={() => setDialog(null)}
								>
									{copy("取消", "Cancel")}
								</button>
								<button
									type="button"
									className="studio-btn primary"
									disabled={busy}
									onClick={() =>
										void run(async () => {
											await store.create();
											setDialog(null);
										})
									}
								>
									{copy("新建空白作品", "Create new story")}
								</button>
							</div>
						</>
					)}
					{dialog === "sample" && (
						<>
							<p>
								{copy(
									"示例会放入一个新项目，不覆盖当前故事。它只填入文字，拆解和绘制仍使用真实模型。",
									"The sample opens as a separate project. It supplies story text; planning and drawing still use real models.",
								)}
							</p>
							<div className="dialog-actions">
								<button
									type="button"
									className="studio-btn"
									onClick={() => setDialog(null)}
								>
									{copy("取消", "Cancel")}
								</button>
								<button
									type="button"
									className="studio-btn primary"
									disabled={busy}
									onClick={() =>
										void run(async () => {
											await store.create();
											update((value) => ({
												...value,
												story: SAMPLE,
												metadata: {
													...value.metadata,
													name: "雨巷里的来信",
												},
												studio: defaultStudio(),
											}));
											await save();
											setDialog(null);
										})
									}
								>
									{copy("载入示例", "Load sample")}
								</button>
							</div>
						</>
					)}
					{dialog === "analyze" && (
						<>
							<p>
								{copy(
									"新的规划成功后，会替换当前角色、分镜和已生成图片。建议先导出项目，保留这个版本。若请求失败，当前作品不变。",
									"A successful new plan replaces characters, panels, and generated images. Export a backup first to keep this version. If planning fails, your current work stays intact.",
								)}
							</p>
							<div className="dialog-actions">
								<button
									type="button"
									className="studio-btn"
									onClick={() => downloadProject(project)}
								>
									{copy("先导出备份", "Export backup")}
								</button>
								<button
									type="button"
									className="studio-btn primary"
									disabled={busy}
									onClick={() => void analyze()}
								>
									{copy("重新拆解", "Re-plan")}
								</button>
							</div>
						</>
					)}
					{dialog === "generate" && (
						<>
							<p>
								{copy(
									`将生成 ${pending.length} 格未完成或待重绘的漫画，必要时先绘制角色参考图。`,
									`Create ${pending.length} missing or outdated frames, generating character references first if needed.`,
								)}
							</p>
							<div className="generation-confirm">
								<CheckCircle2 size={20} />
								<span>
									{project.storyAnalysis?.characters
										.map((character) => character.name)
										.join(" · ")}
									<br />
									{zh ? styleLabel?.zh : styleLabel?.en} ·{" "}
									{project.imageSize.aspectRatio} · {project.studio.aiModel}
								</span>
							</div>
							<p className="muted">
								{copy(
									"使用服务器配置的真实模型，可能产生费用。价格取决于服务商；本应用无法预估准确金额。可以在当前请求完成后暂停。",
									"Uses the server-configured models and may incur provider charges. Exact pricing is not available here. Pause stops after the current request.",
								)}
							</p>
							<div className="dialog-actions">
								<button
									type="button"
									className="studio-btn"
									onClick={() => setDialog(null)}
								>
									{copy("再检查一下", "Review again")}
								</button>
								<button
									type="button"
									className="studio-btn primary"
									disabled={busy}
									onClick={() => void generate()}
								>
									{copy("开始生成", "Start generation")}
									<ArrowRight size={16} />
								</button>
							</div>
						</>
					)}
					{dialog === "projects" && (
						<div className="project-list">
							{projects.length ? (
								projects.map((item) => (
									<button
										type="button"
										className="project-row"
										key={item.metadata.id}
										disabled={busy}
										onClick={() =>
											void run(async () => {
												await store.open(item.metadata.id);
												setDialog(null);
											})
										}
									>
										<BookOpen size={22} />
										<span>
											<strong>{item.metadata.name}</strong>
											<small>
												{item.metadata.panelCount} {copy("格", "frames")} ·{" "}
												{new Date(item.metadata.updatedAt).toLocaleDateString()}
											</small>
										</span>
										{item.metadata.id === project.metadata.id ? (
											<Check size={18} />
										) : (
											<ArrowRight size={18} />
										)}
									</button>
								))
							) : (
								<p>{copy("还没有保存的项目。", "No saved projects yet.")}</p>
							)}
						</div>
					)}
					{dialog === "export" && (
						<>
							<p>
								{copy(
									`导出已生成的 ${project.generatedPanels.length} 格漫画。`,
									`Export ${project.generatedPanels.length} generated frames.`,
								)}
								{pending.length > 0 && (
									<span className="export-warning">
										{" "}
										{copy(
											`还有 ${pending.length} 格缺失或待重绘，导出会包含已有旧图，请先检查。`,
											`${pending.length} frames are missing or outdated. Existing old images will be included; check before exporting.`,
										)}
									</span>
								)}
							</p>
							<ComicPageComposer
								key={project.metadata.id}
								project={project}
								zh={zh}
								disabled={busy}
								onLayout={changeComicLayout}
								onCaptions={(show) =>
									update((value) => ({
										...value,
										studio: { ...value.studio, comicCaptions: show },
									}))
								}
							/>
							<div className="export-options">
								<button
									type="button"
									className="project-row"
									disabled={busy}
									onClick={() =>
										void run(async () => {
											setStatus(
												copy("正在导出漫画页面…", "Exporting comic pages…"),
											);
											await exportComicPages(project);
											setDialog(null);
										})
									}
								>
									<Download size={22} />
									<span>
										<strong>
											{copy("漫画页面 · PNG", "Comic pages · PNG")}
										</strong>
										<small>
											{copy(
												"使用上方排版导出，长篇自动分页打包",
												"Export the layout above; longer stories export as a ZIP",
											)}
										</small>
									</span>
								</button>
								<button
									type="button"
									className="project-row"
									disabled={busy}
									onClick={() =>
										void run(async () => {
											setStatus(
												copy("正在打包原图…", "Packaging original images…"),
											);
											await exportPanels(project);
											setDialog(null);
										})
									}
								>
									<FolderOpen size={22} />
									<span>
										<strong>
											{copy(
												"原图与项目 · ZIP",
												"Original images & project · ZIP",
											)}
										</strong>
										<small>
											{copy(
												"包含角色参考图、所有已完成分镜和项目 JSON",
												"Character references, completed panels, and project JSON",
											)}
										</small>
									</span>
								</button>
								<button
									type="button"
									className="project-row"
									disabled={busy}
									onClick={() => {
										setDialog(null);
										share();
									}}
								>
									<Upload size={22} />
									<span>
										<strong>
											{copy("分享导出的作品", "Share exported artwork")}
										</strong>
										<small>
											{copy(
												"导出漫画文件后自行分享，无需登录",
												"Export comic files to share them yourself. No sign-in required.",
											)}
										</small>
									</span>
								</button>
							</div>
						</>
					)}
					{dialog === "versions" && activePanel && (
						<>
							<p>
								{copy(
									"恢复只替换这一格的图片，当前脚本不变；恢复后会标记待检查。",
									"Restore changes only this frame’s image. The current script stays unchanged; the frame will be marked for review.",
								)}
							</p>
							<div className="version-list">
								{project.studio.panelVersions?.[activePanel.panelNumber]?.map(
									(version, index) => (
										<div key={`${activePanel.panelNumber}-${index}`}>
											<img
												src={version.image}
												alt={copy(
													`历史图片 ${index + 1}`,
													`Previous image ${index + 1}`,
												)}
											/>
											<button
												type="button"
												className="studio-btn"
												disabled={busy}
												onClick={() => {
													retainPanel(version);
													update((value) => ({
														...value,
														studio: {
															...value.studio,
															stalePanels: [
																...new Set([
																	...value.studio.stalePanels,
																	version.panelNumber,
																]),
															],
														},
													}));
													setDialog(null);
												}}
											>
												{copy("恢复这张图片", "Restore image")}
											</button>
										</div>
									),
								)}
							</div>
						</>
					)}
					{dialog === "help" && (
						<>
							<p>
								{copy(
									"故事 → 审核角色与分镜 → 生成 → 单格精修和导出。项目与图片保存在当前浏览器，不会自动同步到其他设备。",
									"Story → review characters and storyboard → generate → refine individual frames and export. Projects are stored in this browser and do not automatically sync across devices.",
								)}
							</p>
							<p>
								{copy(
									market
										? "Market 版使用 NeoWoW 网页 AI 接口。点击右上角账户登录后，文本规划使用自己的 Coding Plan 额度，图像生成使用自己的积分。输出尺寸以模型默认值为准。网页 AI 和 CLI 使用不同凭证。"
										: "本地工作台无需注册或登录。右上角「关联 NeoWoW」可查看 CLI 安装与专用 Key 设置步骤，并检查本机账户状态。工作台生成仍按本地 Google AI / 火山引擎配置执行。",
									market
										? "The Market edition uses NeoWoW web AI APIs. Sign in through the account button; planning uses your own Coding Plan quota and images use your own credits. Output resolution follows model defaults. Web AI and CLI use different credentials."
										: "The local studio needs no application account. Connect NeoWoW in the header for CLI setup and account verification. Studio generation still uses your local Google AI / Volcengine configuration.",
								)}
							</p>
							<p>
								{copy(
									"请定期导出项目 JSON 或 ZIP 备份。清理浏览器数据会删除本地项目。",
									"Export JSON or ZIP backups regularly. Clearing browser data deletes local projects.",
								)}
							</p>
							<p>
								<strong>
									{copy("NeoWoW CLI 凭证设置", "NeoWoW CLI credentials")}
								</strong>
								<br />
								{copy(
									"网页登录获取的凭证不能用于调用 neowow-cli。使用 CLI 前，请到 NeoWoW「用户中心 → CLI」生成专用 API Key，在自己的终端运行 neowow login 配置，再用 neowow whoami 确认。网页登录不会自动配置 CLI；更换 Key 后需重新登录 CLI。",
									"Web login credentials cannot authenticate neowow-cli. Before using the CLI, generate a dedicated API Key in NeoWoW User Center → CLI, run neowow login in your own terminal, then verify with neowow whoami. Web login does not configure the CLI; log in again after replacing the Key.",
								)}
							</p>
							<p className="muted micro">
								{copy(
									market
										? "CLI Key 不要填入故事或项目备份，也不要提交到 GitHub。CLI 配置在自己的终端完成，不能用网页登录凭证替代。"
										: "CLI Key 不要填入故事或项目备份，也不要提交到 GitHub。此步骤仅配置 CLI，不能替代当前工作台的 Google / 火山引擎服务端凭据。",
									market
										? "Keep CLI keys out of stories, backups and GitHub. Configure the CLI in your own terminal using its dedicated Key."
										: "Keep the CLI Key out of stories, project backups and GitHub. CLI setup does not replace this studio’s Google / Volcengine server credentials.",
								)}
							</p>
						</>
					)}
				</StudioDialog>
			)}
			{editingCharacter !== null && (
				<StudioDialog
					title={copy("角色设定", "Character direction")}
					onClose={() => setEditingCharacter(null)}
				>
					<div className="studio-fields">
						<label>
							{copy("角色名字", "Name")}
							<input
								value={characterDraft.name}
								maxLength={80}
								onChange={(event) =>
									setCharacterDraft((value) => ({
										...value,
										name: event.target.value,
									}))
								}
							/>
						</label>
						<label>
							{copy("外貌设定", "Appearance")}
							<textarea
								value={characterDraft.physicalDescription}
								rows={4}
								onChange={(event) =>
									setCharacterDraft((value) => ({
										...value,
										physicalDescription: event.target.value,
									}))
								}
							/>
						</label>
						<label>
							{copy("性格", "Personality")}
							<input
								value={characterDraft.personality}
								onChange={(event) =>
									setCharacterDraft((value) => ({
										...value,
										personality: event.target.value,
									}))
								}
							/>
						</label>
						<label>
							{copy("故事里的角色", "Role in the story")}
							<input
								value={characterDraft.role}
								onChange={(event) =>
									setCharacterDraft((value) => ({
										...value,
										role: event.target.value,
									}))
								}
							/>
						</label>
					</div>
					<p className="muted micro">
						{copy(
							"角色变化后需重新生成角色参考，已有分镜会标记为待重绘。",
							"Character changes regenerate their reference and mark existing frames for redraw.",
						)}
					</p>
					<div className="dialog-actions">
						<button
							type="button"
							className="studio-btn"
							onClick={() => setEditingCharacter(null)}
						>
							{copy("取消", "Cancel")}
						</button>
						<button
							type="button"
							className="studio-btn primary"
							disabled={
								!characterDraft.name.trim() ||
								!characterDraft.physicalDescription.trim()
							}
							onClick={saveCharacter}
						>
							{copy("保存角色", "Save character")}
						</button>
					</div>
				</StudioDialog>
			)}
			{preview && (
				<StudioDialog
					title={copy("画面预览", "Image preview")}
					onClose={() => setPreview(null)}
				>
					<img
						className="full-preview"
						src={preview}
						alt={copy("当前分镜大图", "Current panel preview")}
					/>
				</StudioDialog>
			)}
			{dialog === "share" && (
				<StudioDialog
					title={copy("分享你的作品", "Share your artwork")}
					onClose={() => setDialog(null)}
				>
					<p>
						{copy(
							"在「精修与导出」里保存漫画 PNG 或原图 ZIP，再把文件分享给朋友。项目 JSON 可留作备份。整个过程无需注册或登录。",
							"Export a comic PNG or original-image ZIP, then share the files with friends. Keep the project JSON as a backup. No account is needed.",
						)}
					</p>
					<button
						type="button"
						className="studio-btn primary"
						onClick={() => setDialog("export")}
					>
						{copy("返回导出", "Back to export")}
					</button>
				</StudioDialog>
			)}
			{authOpen && (
				<AuthModal
					isOpen
					onClose={() => {
						shareAfterLogin.current = false;
						setAuthOpen(false);
					}}
				/>
			)}
			{shareOpen && (
				<ShareComicModal
					isOpen
					onClose={() => setShareOpen(false)}
					storyTitle={project.metadata.name}
					storyDescription={project.story.slice(0, 500)}
					style={project.style}
					panels={project.generatedPanels.map((panel) => ({
						image_url: panel.image,
						text_content:
							panels.find((item) => item.panelNumber === panel.panelNumber)
								?.dialogue || "",
					}))}
				/>
			)}
		</div>
	);
}
