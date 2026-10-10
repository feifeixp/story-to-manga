import { type AnchorHTMLAttributes, useEffect, useState } from "react";
import { useI18n } from "../src/components/I18nProvider";
import { StudioDialog } from "../src/components/studio/StudioDialog";
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
	const { user } = useAuth();
	if (!isOpen) return null;
	return (
		<StudioDialog title="NeoWoW 账户与使用说明" onClose={onClose}>
			<div className="neo-guide">
				<p>
					{user
						? `已登录：${user.name}`
						: "登录 NeoWoW 后可拆解故事与生成漫画。草稿编辑不需要登录。"}
				</p>
				<p>
					文本规划使用当前用户的 NeoWoW Coding Plan
					额度；图片生成使用当前用户的积分。余额、会员权限和实际价格以平台为准。点击拆解或生成时才提交
					AI 请求。
				</p>
				<button
					type="button"
					className="studio-btn primary"
					onClick={user ? logout : login}
				>
					{user ? "退出登录" : "登录 NeoWoW"}
				</button>
				<h3>CLI 需要单独设置 Key</h3>
				<p>{CLI_NOTICE}</p>
				<pre>neowow login{String.fromCharCode(10)}neowow whoami</pre>
				<p>
					网页登录不会自动配置本机 CLI。不要将 Key 填入故事、参考描述、Market
					文案或项目备份，也不要提交到 GitHub。本应用的网页 AI 接口与 CLI
					使用不同的凭证。
				</p>
				<a href="https://neowow.cn/" target="_blank" rel="noreferrer">
					打开 NeoWoW 用户中心
				</a>
				<a
					href="https://github.com/feifeixp/story-to-manga#readme"
					target="_blank"
					rel="noreferrer"
				>
					开源项目与本地安装方法 ↗
				</a>
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
				<h2>项目保存</h2>
				<p>
					文字与图片保存在当前浏览器，不自动同步到其他设备或账户。请定期导出
					JSON /
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
