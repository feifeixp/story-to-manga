import { Component, type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import previewImage from "../public/studio/story-preview.svg";
import { I18nProvider } from "../src/components/I18nProvider";
import MangaStudio from "../src/components/studio/MangaStudio";
import { configureStudioServices } from "../src/lib/studioWorkflow";
import {
	type ImageModel,
	imageSource,
	listModels,
	requestMarketApi,
} from "./api";
import { pickUpWebSession, useAuth } from "./auth";
import { About, usePath } from "./ui";

pickUpWebSession();
try {
	if (!localStorage.getItem("locale")) localStorage.setItem("locale", "zh");
} catch {
	/* Provider reports storage limitations. */
}
configureStudioServices({ api: requestMarketApi, imageSource });
class ErrorBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		return this.state.failed ? (
			<main className="neo-about">
				<h1>工作台暂时无法打开</h1>
				<p>请检查浏览器存储权限，刷新后重试。</p>
				<a href="/about">查看使用说明</a>
			</main>
		) : (
			this.props.children
		);
	}
}
function App() {
	const path = usePath();
	const { user } = useAuth();
	const userId = user?.id;
	const [models, setModels] = useState<ImageModel[]>([]);
	const [modelError, setModelError] = useState("");
	useEffect(() => {
		setModels([]);
		setModelError("");
		if (!userId) return;
		const controller = new AbortController();
		listModels(controller.signal)
			.then(setModels)
			.catch(() => {
				if (!controller.signal.aborted)
					setModelError("模型列表读取失败，请重新登录后刷新。");
			});
		return () => controller.abort();
	}, [userId]);
	if (path === "/about" || path === "/comics") return <About />;
	return (
		<MangaStudio
			deployment="neowow"
			previewImage={previewImage}
			imageModels={models.map((m) => ({
				id: m.model_name,
				name: m.model_display_name || m.model_name,
			}))}
			modelNotice={
				modelError ||
				(!user
					? "登录 NeoWoW 后加载可用模型。"
					: "文本规划使用自己的 Coding Plan 额度；图片生成消耗自己的积分。输出尺寸以模型默认值为准。")
			}
		/>
	);
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
	<ErrorBoundary>
		<I18nProvider>
			<App />
		</I18nProvider>
	</ErrorBoundary>,
);
