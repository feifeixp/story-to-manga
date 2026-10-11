import {
	ArrowUpRight,
	BookOpen,
	Check,
	Link2,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { type AnchorHTMLAttributes, useEffect, useId, useState } from "react";
import { useI18n } from "../src/components/I18nProvider";
import { StudioDialog } from "../src/components/studio/StudioDialog";
import {
	clearModelCache,
	getBalance,
	getPlanningModel,
	listModels,
	PLANNING_MODELS,
	releaseUncertainTask,
	setPlanningModel,
	uncertainTasks,
} from "./api";
import "../src/components/neowow-account.css";
import { login, logout, useAuth } from "./auth";
export const CLI_NOTICE =
	"网页登录获取的凭证不能用于调用 neowow-cli。使用 CLI 前，请到 NeoWoW「用户中心 → CLI」生成专用 API Key，在自己的终端运行 neowow login 配置，再用 neowow whoami 确认。";
export function AuthModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	return isOpen ? <MarketAccount onClose={onClose} /> : null;
}
function MarketAccount({ onClose }: { onClose: () => void }) {
	const planningModelId = useId();
	const { user, token } = useAuth();
	const [checking, setChecking] = useState(false);
	const [status, setStatus] = useState("");
	const [planningModel, updatePlanningModel] = useState(getPlanningModel);
	const [pending, setPending] = useState<{ key: string; model: string }[]>([]);
	const check = async () => {
		setChecking(true);
		setStatus("");
		clearModelCache();
		const started = performance.now();
		const [models, balance] = await Promise.allSettled([
			listModels(),
			getBalance(),
		]);
		setStatus(
			models.status === "fulfilled"
				? `已连接 · ${models.value.length} 个图像模型 · ${(performance.now() - started).toFixed(0)} ms${balance.status === "fulfilled" ? ` · 可用 ${balance.value} 积分` : " · 积分余额暂不可用"}`
				: models.reason instanceof Error
					? models.reason.message
					: "连接失败，请检查网络后重试。",
		);
		setChecking(false);
	};
	useEffect(() => {
		let active = true;
		if (token)
			void uncertainTasks().then((tasks) => {
				if (active) setPending(tasks);
			});
		else setPending([]);
		return () => {
			active = false;
		};
	}, [token]);
	return (
		<StudioDialog
			title="关联 NeoWoW"
			className="neo-account-dialog"
			onClose={onClose}
		>
			<div className="neo-account-hero">
				<p className="neo-account-eyebrow">
					NEOWOW MARKET / YOUR CREATIVE SPACE
				</p>
				<div className="neo-account-visual" aria-hidden="true">
					<span>
						<BookOpen size={24} />
					</span>
					<i />
					<Link2 size={18} />
					<i />
					<span>
						<Check size={24} />
					</span>
				</div>
				<h3>连接你的 NeoWoW，开始创作。</h3>
				<p>
					无需注册本站。使用你的 NeoWoW
					账户生成漫画，额度与积分归属于你自己的账号。
				</p>
			</div>
			<div className={`neo-account-status ${user ? "is-connected" : ""}`}>
				<Link2 size={16} />
				<output>{user ? `已关联 · ${user.name}` : "尚未关联 NeoWoW"}</output>
			</div>
			<div className="neo-account-steps">
				<section>
					<span className="neo-step-number">01</span>
					<div>
						<h4>关联 NeoWoW 账户</h4>
						<p>已有账号可直接关联；还没有账号，推荐先注册 NeoWoW。</p>
						<button
							type="button"
							className="studio-btn primary"
							onClick={user ? logout : login}
						>
							{user ? "解除关联" : "关联 / 登录 NeoWoW"}
						</button>
						<a
							className="neo-account-link"
							href="https://neowow.cn/"
							target="_blank"
							rel="noreferrer"
						>
							注册 / 打开 NeoWoW
							<ArrowUpRight size={15} />
						</a>
					</div>
				</section>
				<section>
					<span className="neo-step-number">02</span>
					<div>
						<h4>选择创作模型</h4>
						<label className="neo-planning-field" htmlFor={planningModelId}>
							故事拆解模型
							<select
								id={planningModelId}
								value={planningModel}
								onChange={(event) => {
									try {
										setPlanningModel(event.target.value);
										updatePlanningModel(event.target.value);
									} catch {
										setStatus("模型选择未保存，请检查浏览器存储权限。");
									}
								}}
							>
								{PLANNING_MODELS.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name}
									</option>
								))}
							</select>
						</label>
						<p>
							图片默认优先 Neo Image
							2.5，不随语言切换，按平台实时价格计费；故事规划通过方式一使用自己的
							Coding Plan
							额度，与图片积分分开计费。切换账号会切换浏览器工作区，旧版草稿保留在未关联时的工作区。
						</p>
						<p>
							用于故事拆解与分镜规划，选择会保存在当前浏览器。图片模型在创作设置中选择。
						</p>
						{user && (
							<>
								<button
									type="button"
									className="studio-btn"
									disabled={checking}
									onClick={() => void check()}
								>
									{checking ? (
										<Loader2 size={15} className="spin" />
									) : (
										<RefreshCw size={15} />
									)}
									检查连接与积分
								</button>
								<output>
									{checking ? "正在查询模型与积分，不会发起生成…" : status}
								</output>
							</>
						)}
					</div>
				</section>
				{pending.length > 0 && (
					<section>
						<span className="neo-step-number">!</span>
						<div>
							<h4>有提交结果不确定的任务</h4>
							<p>
								为避免重复扣费，已暂停这些请求。请先打开 NeoWoW
								核对生成记录；确认允许重新生成后再解除限制。
							</p>
							{pending.map((task) => (
								<div key={task.key}>
									<p>{task.model}</p>
									<button
										type="button"
										className="studio-btn"
										onClick={async () => {
											await releaseUncertainTask(task.key);
											setPending(await uncertainTasks());
										}}
									>
										已核对记录，允许新任务
									</button>
								</div>
							))}
						</div>
					</section>
				)}
				<section>
					<span className="neo-step-number">03</span>
					<div>
						<h4>本地创作可搭配 neowow-cli</h4>
						<p>{CLI_NOTICE}</p>
						<details>
							<summary>查看本地 CLI 命令</summary>
							<pre>neowow login{String.fromCharCode(10)}neowow whoami</pre>
						</details>
					</div>
				</section>
			</div>
			<div className="neo-account-footer">
				<p>
					网页生成无需安装 CLI，也无需填写 CLI
					Key。作品保存在当前浏览器，请及时导出备份。
				</p>
				<div>
					<a
						className="studio-btn"
						href="https://neowow.studio/account/api-docs"
						target="_blank"
						rel="noreferrer"
					>
						官方接口文档
						<ArrowUpRight size={15} />
					</a>
					<button
						type="button"
						className="studio-btn primary"
						onClick={onClose}
					>
						继续创作
					</button>
				</div>
			</div>
		</StudioDialog>
	);
}
export function ShareComicModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
	storyTitle?: string;
	storyDescription?: string;
	style?: string;
	panels?: unknown[];
}) {
	if (!isOpen) return null;
	return (
		<StudioDialog title="分享作品" onClose={onClose}>
			<div className="neo-guide">
				<p>
					请在第四步使用「导出」保存漫画 PNG 或原图 ZIP，然后将文件分享给朋友。
				</p>
				<p>
					Market 版草稿保存在当前浏览器；NeoWoW 登录不会将它们发布到原项目的
					Supabase 图库。
				</p>
				<button type="button" className="studio-btn primary" onClick={onClose}>
					返回精修与导出
				</button>
			</div>
		</StudioDialog>
	);
}
export default function Link(
	props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
) {
	return <a {...props} />;
}
export function useRouter() {
	return {
		push: (url: string) => {
			history.pushState({}, "", url);
			window.dispatchEvent(new PopStateEvent("popstate"));
		},
	};
}
export function LanguageSwitcher() {
	const { language, setLocale } = useI18n();
	return (
		<button
			type="button"
			className="studio-btn small"
			onClick={() => setLocale(language.startsWith("zh") ? "en" : "zh")}
			aria-label="切换语言 / Switch language"
		>
			{language.startsWith("zh") ? "EN" : "中文"}
		</button>
	);
}
export function usePath() {
	const [path, setPath] = useState(location.pathname);
	useEffect(() => {
		const refresh = () => setPath(location.pathname);
		window.addEventListener("popstate", refresh);
		return () => window.removeEventListener("popstate", refresh);
	}, []);
	return path;
}
export function About() {
	return (
		<main className="manga-studio neo-about">
			<article className="neo-guide">
				<p className="neo-eyebrow">OPEN SOURCE · MIT · NEOWOW MARKET</p>
				<h1>Story to Manga</h1>
				<p>把文字故事变成可逐格打磨的漫画。四步完成创作，随时保存和导出。</p>
				<a
					className="studio-btn primary"
					href="/app"
					onClick={(e) => {
						e.preventDefault();
						history.pushState({}, "", "/app");
						window.dispatchEvent(new PopStateEvent("popstate"));
					}}
				>
					进入创作工作台 →
				</a>
				<h2>使用方法</h2>
				<ol>
					<li>
						写故事：新建项目，输入故事，选择画风、画幅、分镜数量和图像模型。
					</li>
					<li>
						审核：点击拆解，检查并编辑角色、场景、镜头和对白，可上传参考图。
					</li>
					<li>
						生成：确认分镜后生成。角色参考图和漫画逐张生成，支持暂停与补齐。
					</li>
					<li>
						精修：重绘单格、按说明修改画面或恢复旧版本。导出漫画 PNG、原图 ZIP
						和项目 JSON。
					</li>
				</ol>
				<p>
					AI 操作需要登录 NeoWoW。文本规划消耗当前用户的 Coding Plan
					额度；图片消耗当前用户积分。模型权限、参考图数量和价格以平台为准。输出尺寸由图像模型的默认配置决定；界面选择的是画幅比例。
				</p>
				<h2>网页 API 接入</h2>
				<p>
					故事拆解与分镜规划通过官方「方式一」Coding Plan 接口，默认使用 豆包
					2.1 Pro，可在右上角账户面板切换为 Kimi K3。Market
					网页使用当前登录身份；外部程序使用带 chat:invoke
					权限的部署令牌。文本额度与图片积分分别计费。
				</p>
				<p>
					图片使用官方「方式二」neowow.cn/agent 接口，以当前账号 accessToken
					鉴权，通过 NeoWoW 现有跨域网关访问，无需 ECS 或独立后端。异步任务每 3
					秒查询，单轮最多等待 3 分钟，超时保留任务编号供继续查询。
				</p>
				<h2>项目保存</h2>
				<p>
					文字与图片按 NeoWoW
					账号分工作区保存在当前浏览器，不自动同步到其他设备。请定期导出 JSON /
					ZIP；清理浏览器数据会删除草稿。在线图片如不允许跨域下载，导出会报错，请打开原图保存。当前没有一键导入备份入口。
				</p>
				<h2>开源项目</h2>
				<a
					href="https://github.com/feifeixp/story-to-manga"
					target="_blank"
					rel="noreferrer"
				>
					github.com/feifeixp/story-to-manga ↗
				</a>
				<p>
					源代码采用 MIT 协议，保留原作者版权。Market 使用独立静态前端入口，本地
					Next.js 版本仍支持 Google / 火山引擎模型接口。
				</p>
				<h3>本地运行 Next.js 版本</h3>
				<p>
					准备 Node.js 24 与 pnpm，按仓库 README 配置 .env.local
					中的服务端模型凭据。
				</p>
				<pre>
					{
						"git clone https://github.com/feifeixp/story-to-manga.git\ncd story-to-manga\npnpm install --frozen-lockfile\ncp .env.local.example .env.local\n# 配置 GOOGLE_AI_API_KEY 等服务端凭据\npnpm dev --hostname 127.0.0.1\n# 打开 http://localhost:8000/app"
					}
				</pre>
				<h2>NeoWoW CLI 专用 Key</h2>
				<p>
					<strong>{CLI_NOTICE}</strong>
				</p>
				<pre>
					{
						'neowow login\nneowow whoami\n# 或 neowow login --api-key "<你的 CLI API Key>"'
					}
				</pre>
				<p>
					CLI 使用 api-key 鉴权。网页登录的 Authorization / Bearer / accessToken
					不能替代 CLI Key。重新生成 Key 会使旧 Key
					失效，需要重新配置。请在自己的终端设置 Key，不要在本应用输入；Key
					不会写入项目或导出文件。
				</p>
				<a
					href="https://github.com/feifeixp/story-to-manga#readme"
					target="_blank"
					rel="noreferrer"
				>
					查看完整 README ↗
				</a>
			</article>
		</main>
	);
}
