"use client";
import {
	ArrowUpRight,
	BookOpen,
	Check,
	Copy,
	Link2,
	Loader2,
	RefreshCw,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { StudioDialog } from "@/components/studio/StudioDialog";
import type { CliStatus } from "@/lib/neowowCli";
import "@/app/app/studio.css";
import "./neowow-account.css";

const INSTALL_MAC =
	"curl -fsSL https://wlpaas.oss-cn-shanghai.aliyuncs.com/agent/neowow-canvas/install.sh | bash -s -- --all";
const INSTALL_WINDOWS =
	"& ([scriptblock]::Create((irm https://wlpaas.oss-cn-shanghai.aliyuncs.com/agent/neowow-canvas/install.ps1))) -All";

function Command({
	value,
	label,
	copyLabel,
}: {
	value: string;
	label: string;
	copyLabel: string;
}) {
	const [copied, setCopied] = useState(false);
	const [failed, setFailed] = useState(false);
	return (
		<div className="neo-command-wrap">
			<div className="neo-command">
				<pre>
					<code>{value}</code>
				</pre>
				<button
					type="button"
					aria-label={label}
					title={label}
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(value);
							setCopied(true);
							setFailed(false);
						} catch {
							setFailed(true);
						}
					}}
				>
					{copied ? <Check size={15} /> : <Copy size={15} />}
					<span>{copied ? "✓" : copyLabel}</span>
				</button>
			</div>
			{failed && (
				<output>
					{copyLabel === "复制"
						? "请选中命令手动复制。"
						: "Select the command to copy manually."}
				</output>
			)}
		</div>
	);
}

export function AuthModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	return isOpen ? <NeoWoWAccount onClose={onClose} /> : null;
}
function NeoWoWAccount({ onClose }: { onClose: () => void }) {
	const { language } = useI18n();
	const zh = language.startsWith("zh");
	const t = (cn: string, en: string) => (zh ? cn : en);
	const [account, setAccount] = useState<CliStatus | null>(null);
	const [checking, setChecking] = useState(true);
	const [platform, setPlatform] = useState<"mac" | "windows">("mac");
	const refresh = useCallback(async (signal?: AbortSignal) => {
		setChecking(true);
		try {
			const response = await fetch("/api/neowow/account", {
				cache: "no-store",
				...(signal ? { signal } : {}),
			});
			const result = await response.json();
			if (!signal?.aborted)
				setAccount(response.ok ? result : { status: "unavailable" });
		} catch {
			if (!signal?.aborted) setAccount({ status: "unavailable" });
		} finally {
			if (!signal?.aborted) setChecking(false);
		}
	}, []);
	useEffect(() => {
		const controller = new AbortController();
		void refresh(controller.signal);
		return () => controller.abort();
	}, [refresh]);
	const connected = account?.status === "connected";
	const status = checking
		? t("正在检查本机 CLI…", "Checking this computer’s CLI…")
		: connected
			? t(`已关联 · ${account.nickname}`, `Connected · ${account.nickname}`)
			: account?.status === "not-installed"
				? t("尚未安装 CLI", "CLI is not installed")
				: account?.status === "not-linked"
					? t("尚未关联 NeoWoW", "NeoWoW is not connected")
					: t(
							"暂时无法确认连接，请在终端运行 neowow whoami",
							"Unable to verify. Run neowow whoami in your terminal.",
						);
	return (
		<StudioDialog
			title={t("关联 NeoWoW", "Connect NeoWoW")}
			className="neo-account-dialog"
			onClose={onClose}
		>
			<div className="neo-account-hero">
				<p className="neo-account-eyebrow">LOCAL WORKSPACE / NEOWOW CLI</p>
				<div className="neo-account-visual" aria-hidden="true">
					<span>
						<BookOpen size={24} />
					</span>
					<i />
					<Link2 size={18} />
					<i />
					<span>
						<Terminal size={24} />
					</span>
				</div>
				<h3>
					{t(
						"本地创作，连接你的 NeoWoW。",
						"Create locally. Connect with NeoWoW.",
					)}
				</h3>
				<p>
					{t(
						"无需注册本站。故事、漫画与项目保存在当前浏览器，随时编辑、保存和导出。",
						"No account here is needed. Your stories, artwork and projects stay in this browser, ready to edit, save and export.",
					)}
				</p>
			</div>
			<div className={`neo-account-status ${connected ? "is-connected" : ""}`}>
				{checking ? (
					<Loader2 size={16} className="spin" />
				) : connected ? (
					<Check size={16} />
				) : (
					<Link2 size={16} />
				)}
				<output>{status}</output>
				<button
					type="button"
					disabled={checking}
					onClick={() => void refresh()}
					aria-label={t("刷新关联状态", "Refresh connection")}
					title={t("刷新关联状态", "Refresh connection")}
				>
					<RefreshCw size={15} />
				</button>
			</div>
			<div className="neo-account-steps">
				<section>
					<span className="neo-step-number">01</span>
					<div>
						<h4>{t("准备你的 NeoWoW 账户", "Get your NeoWoW account")}</h4>
						<p>
							{t(
								"推荐注册 NeoWoW，用自己的账户管理 AI 创作与积分。已有账户可以直接继续。",
								"We recommend NeoWoW for managing AI creations and credits. Already have an account? Continue below.",
							)}
						</p>
						<a
							className="neo-account-link"
							href="https://neowow.cn/"
							target="_blank"
							rel="noreferrer"
						>
							{t("注册 / 打开 NeoWoW", "Register / open NeoWoW")}
							<ArrowUpRight size={15} />
						</a>
					</div>
				</section>
				<section>
					<span className="neo-step-number">02</span>
					<div>
						<h4>{t("安装 neowow-cli", "Install neowow-cli")}</h4>
						<p>
							{t(
								"让 Codex 或 Claude Code 在终端里帮你创建画布、生成图片与视频。",
								"Use Codex or Claude Code to create canvases, images and videos from your terminal.",
							)}
						</p>
						<details>
							<summary>{t("查看安装命令", "Show install command")}</summary>
							<fieldset
								className="neo-platforms"
								aria-label={t("操作系统", "Operating system")}
							>
								<button
									type="button"
									aria-pressed={platform === "mac"}
									onClick={() => setPlatform("mac")}
								>
									macOS / Linux
								</button>
								<button
									type="button"
									aria-pressed={platform === "windows"}
									onClick={() => setPlatform("windows")}
								>
									Windows
								</button>
							</fieldset>
							<Command
								value={platform === "mac" ? INSTALL_MAC : INSTALL_WINDOWS}
								label={t("复制安装命令", "Copy install command")}
								copyLabel={t("复制", "Copy")}
							/>
							<small>
								{t(
									"安装完成后重新打开终端。",
									"Open a new terminal after installation.",
								)}
							</small>
						</details>
					</div>
				</section>
				<section>
					<span className="neo-step-number">03</span>
					<div>
						<h4>
							{t(
								"使用 CLI 专用 Key 关联账户",
								"Connect with your dedicated CLI Key",
							)}
						</h4>
						<p>
							{t(
								"在 NeoWoW「用户中心 → CLI」生成专用 API Key，然后在自己的终端执行以下命令，按提示输入 Key。",
								"Generate a dedicated API Key in NeoWoW User Center → CLI. Run these commands in your own terminal and enter the Key when prompted.",
							)}
						</p>
						<Command
							value={"neowow login\nneowow whoami"}
							label={t("复制关联命令", "Copy connection commands")}
							copyLabel={t("复制", "Copy")}
						/>
						<p className="neo-key-note">
							{t(
								"网页登录凭证不能用于 CLI。Key 只在终端配置，无需填入本工作台。",
								"Web login credentials cannot authenticate the CLI. Configure the Key in your terminal; this studio does not need it.",
							)}
						</p>
					</div>
				</section>
			</div>
			<div className="neo-account-footer">
				<p>
					{t(
						"CLI 用于终端创作；工作台生成仍使用本地配置的模型服务。",
						"The CLI is for terminal creation. Studio generation still uses your locally configured model services.",
					)}
				</p>
				<div>
					<button
						type="button"
						className="studio-btn"
						disabled={checking}
						onClick={() => void refresh()}
					>
						{checking ? (
							<Loader2 size={15} className="spin" />
						) : (
							<RefreshCw size={15} />
						)}
						{t("检查关联", "Check connection")}
					</button>
					<button
						type="button"
						className="studio-btn primary"
						onClick={onClose}
					>
						{t("继续创作", "Continue creating")}
					</button>
				</div>
			</div>
		</StudioDialog>
	);
}
