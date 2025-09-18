"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";
import { ComicCard, ComicCardSkeleton } from "@/components/ComicCard";
import { ComicReader } from "@/components/ComicReader";
import { ComicService } from "@/lib/services/comicService";
import type { Comic } from "@/lib/types/comic";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	BookOpen,
	Palette,
	Zap,
	Globe,
	ArrowRight,
	Play,
	Share2,
	Heart,
	Eye
} from "lucide-react";

interface SharedWork {
	id: string;
	title: string;
	author: string;
	authorAvatar?: string;
	thumbnail: string;
	description: string;
	style: string;
	panels: number;
	likes: number;
	views: number;
	createdAt: string;
	tags: string[];
}

export default function HomePage() {
	const router = useRouter();
	const { language } = useI18n();
	const { user, signOut, loading } = useAuth();
	const [showAuthModal, setShowAuthModal] = useState(false);
	const [featuredWorks, setFeaturedWorks] = useState<SharedWork[]>([]);
	const [featuredComics, setFeaturedComics] = useState<Comic[]>([]);
	const [comicsLoading, setComicsLoading] = useState(true);
	const [selectedComic, setSelectedComic] = useState<Comic | null>(null);

	// 加载推荐漫画
	useEffect(() => {
		const loadFeaturedComics = async () => {
			setComicsLoading(true);
			try {
				const result = await ComicService.getFeaturedComics(6);
				if (result.success && result.data) {
					setFeaturedComics(result.data);
				}
			} catch (error) {
				console.error('Failed to load featured comics:', error);
			} finally {
				setComicsLoading(false);
			}
		};

		loadFeaturedComics();
	}, []);

	// 模拟用户数据和作品数据
	useEffect(() => {
		// 模拟获取精选作品
		const mockWorks: SharedWork[] = [
			{
				id: "1",
				title: language === 'zh' ? "修仙传说" : "Cultivation Legend",
				author: "张三",
				thumbnail: "https://via.placeholder.com/300x200/8B5CF6/FFFFFF?text=Wuxia+Comic",
				description: language === 'zh' ? "一个关于修仙者的史诗故事" : "An epic story about cultivators",
				style: "wuxia",
				panels: 12,
				likes: 156,
				views: 1240,
				createdAt: "2024-12-15",
				tags: ["武侠", "修仙", "冒险"]
			},
			{
				id: "2",
				title: language === 'zh' ? "都市英雄" : "Urban Hero",
				author: "李四",
				thumbnail: "https://via.placeholder.com/300x200/3B82F6/FFFFFF?text=Comic+Hero",
				description: language === 'zh' ? "现代都市中的超级英雄故事" : "A superhero story in modern city",
				style: "comic",
				panels: 8,
				likes: 89,
				views: 567,
				createdAt: "2024-12-14",
				tags: ["超级英雄", "都市", "动作"]
			},
			{
				id: "3",
				title: language === 'zh' ? "治愈小屋" : "Healing Cottage",
				author: "王五",
				thumbnail: "https://via.placeholder.com/300x200/10B981/FFFFFF?text=Healing+Story",
				description: language === 'zh' ? "温暖治愈的日常生活故事" : "A warm and healing daily life story",
				style: "healing",
				panels: 6,
				likes: 234,
				views: 890,
				createdAt: "2024-12-13",
				tags: ["治愈", "日常", "温馨"]
			}
		];
		setFeaturedWorks(mockWorks);
	}, [language]);

	const handleLogin = () => {
		setShowAuthModal(true);
	};

	const handleLogout = async () => {
		await signOut();
	};

	const handleStartCreating = () => {
		if (!user) {
			// 如果用户未登录，显示登录模态框
			setShowAuthModal(true);
		} else {
			// 如果用户已登录，跳转到创作页面
			router.push('/app');
		}
	};

	const features = [
		{
			icon: <BookOpen className="h-8 w-8" />,
			title: language === 'zh' ? "智能故事分析" : "Smart Story Analysis",
			description: language === 'zh' ? "AI自动分析故事结构，提取角色和场景信息" : "AI automatically analyzes story structure, extracts characters and scenes"
		},
		{
			icon: <Palette className="h-8 w-8" />,
			title: language === 'zh' ? "10种漫画风格" : "10 Comic Styles",
			description: language === 'zh' ? "支持日漫、美漫、武侠、治愈等多种风格" : "Support manga, comic, wuxia, healing and more styles"
		},
		{
			icon: <Zap className="h-8 w-8" />,
			title: language === 'zh' ? "批量生成" : "Batch Generation",
			description: language === 'zh' ? "高效批量生成面板，快速完成漫画创作" : "Efficient batch panel generation for quick comic creation"
		},
		{
			icon: <Globe className="h-8 w-8" />,
			title: language === 'zh' ? "双语支持" : "Bilingual Support",
			description: language === 'zh' ? "完整的中英文界面和AI生成内容" : "Complete Chinese and English interface and AI content"
		}
	];

	return (
		<div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
			{/* Header */}
			<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<BookOpen className="h-8 w-8 text-purple-600" />
						<h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
							Story to Manga Enhanced
						</h1>
					</div>

					<div className="flex items-center space-x-4">
						{/* 导航菜单 */}
						<nav className="hidden md:flex items-center space-x-6">
							<Button
								variant="ghost"
								onClick={() => router.push('/comics')}
								className="text-gray-700 hover:text-purple-600"
							>
								{language === 'zh' ? '漫画作品' : 'Comics'}
							</Button>
						</nav>
						<LanguageSwitcher />
						{user ? (
							<div className="flex items-center space-x-3">
								<img
									src={user.avatar || "https://via.placeholder.com/40x40/6366F1/FFFFFF?text=U"}
									alt={user.name}
									className="w-8 h-8 rounded-full"
								/>
								<span className="text-sm font-medium">{user.name}</span>
								<Button variant="outline" size="sm" onClick={handleLogout}>
									{language === 'zh' ? '退出' : 'Logout'}
								</Button>
							</div>
						) : (
							<Button onClick={handleLogin} disabled={loading}>
								{loading ? (language === 'zh' ? '加载中...' : 'Loading...') : (language === 'zh' ? '登录' : 'Login')}
							</Button>
						)}
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<section className="py-20 px-4">
				<div className="container mx-auto text-center">
					<h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
						{language === 'zh' ? '将你的故事转化为精美漫画' : 'Transform Your Stories into Beautiful Comics'}
					</h2>
					<p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
						{language === 'zh'
							? '使用AI技术，轻松将文字故事转换为专业级漫画。支持10种风格，完整双语体验，让创作变得简单而有趣。'
							: 'Use AI technology to easily convert text stories into professional comics. Support 10 styles, complete bilingual experience, making creation simple and fun.'
						}
					</p>
					{!user && (
						<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
							<p className="text-blue-800 text-sm text-center">
								{language === 'zh'
									? '🔐 请先登录以开始创作您的漫画作品'
									: '🔐 Please login first to start creating your comic works'
								}
							</p>
						</div>
					)}
					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
						<Button size="lg" onClick={handleStartCreating} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
							<Play className="mr-2 h-5 w-5" />
							{user
								? (language === 'zh' ? '开始创作' : 'Start Creating')
								: (language === 'zh' ? '登录并开始创作' : 'Login & Start Creating')
							}
						</Button>
						<Button size="lg" variant="outline">
							<Eye className="mr-2 h-5 w-5" />
							{language === 'zh' ? '查看示例' : 'View Examples'}
						</Button>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-16 px-4 bg-white/50">
				<div className="container mx-auto">
					<h3 className="text-3xl font-bold text-center mb-12">
						{language === 'zh' ? '强大功能' : 'Powerful Features'}
					</h3>
					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
						{features.map((feature, index) => (
							<Card key={index} className="text-center hover:shadow-lg transition-shadow">
								<CardHeader>
									<div className="mx-auto mb-4 p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full w-fit">
										{feature.icon}
									</div>
									<CardTitle className="text-lg">{feature.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<CardDescription>{feature.description}</CardDescription>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* Featured Comics Section */}
			<section className="py-16 px-4 bg-gray-50">
				<div className="container mx-auto">
					<div className="flex items-center justify-between mb-12">
						<h3 className="text-3xl font-bold">
							{language === 'zh' ? '热门漫画' : 'Popular Comics'}
						</h3>
						<Button
							variant="outline"
							onClick={() => router.push('/comics')}
						>
							{language === 'zh' ? '查看更多' : 'View More'}
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					</div>

					{/* 漫画网格 */}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
						{comicsLoading ? (
							Array.from({ length: 6 }).map((_, index) => (
								<ComicCardSkeleton key={index} />
							))
						) : (
							featuredComics.map((comic) => (
								<ComicCard
									key={comic.id}
									comic={comic}
									onClick={setSelectedComic}
								/>
							))
						)}
					</div>
				</div>
			</section>

			{/* Featured Works Section */}
			<section className="py-16 px-4">
				<div className="container mx-auto">
					<div className="flex items-center justify-between mb-12">
						<h3 className="text-3xl font-bold">
							{language === 'zh' ? '精选作品' : 'Featured Works'}
						</h3>
						<Button variant="outline">
							{language === 'zh' ? '查看更多' : 'View More'}
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
						{featuredWorks.map((work) => (
							<Card key={work.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
								<div className="aspect-video bg-gray-200 relative">
									<img
										src={work.thumbnail}
										alt={work.title}
										className="w-full h-full object-cover"
									/>
									<Badge className="absolute top-2 right-2 bg-purple-600">
										{work.style}
									</Badge>
								</div>
								<CardHeader>
									<div className="flex items-center space-x-2 mb-2">
										<img
											src={work.authorAvatar || "https://via.placeholder.com/24x24/6366F1/FFFFFF?text=A"}
											alt={work.author}
											className="w-6 h-6 rounded-full"
										/>
										<span className="text-sm text-gray-600">{work.author}</span>
									</div>
									<CardTitle className="text-lg">{work.title}</CardTitle>
									<CardDescription>{work.description}</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex items-center justify-between text-sm text-gray-500 mb-3">
										<span>{work.panels} {language === 'zh' ? '个面板' : 'panels'}</span>
										<span>{work.createdAt}</span>
									</div>
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4 text-sm text-gray-500">
											<div className="flex items-center space-x-1">
												<Heart className="h-4 w-4" />
												<span>{work.likes}</span>
											</div>
											<div className="flex items-center space-x-1">
												<Eye className="h-4 w-4" />
												<span>{work.views}</span>
											</div>
										</div>
										<Button size="sm" variant="ghost">
											<Share2 className="h-4 w-4" />
										</Button>
									</div>
									<div className="flex flex-wrap gap-1 mt-3">
										{work.tags.map((tag, index) => (
											<Badge key={index} variant="secondary" className="text-xs">
												{tag}
											</Badge>
										))}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-16 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
				<div className="container mx-auto text-center">
					<h3 className="text-3xl font-bold mb-4">
						{language === 'zh' ? '准备好开始创作了吗？' : 'Ready to Start Creating?'}
					</h3>
					<p className="text-xl mb-8 opacity-90">
						{language === 'zh'
							? '加入我们的创作者社区，分享你的精彩故事'
							: 'Join our creator community and share your amazing stories'
						}
					</p>
					<Button size="lg" variant="secondary" onClick={handleStartCreating}>
						<Play className="mr-2 h-5 w-5" />
						{user
							? (language === 'zh' ? '立即开始' : 'Get Started Now')
							: (language === 'zh' ? '登录开始' : 'Login to Start')
						}
					</Button>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-8 px-4 bg-gray-900 text-white">
				<div className="container mx-auto text-center">
					<div className="flex items-center justify-center space-x-2 mb-4">
						<BookOpen className="h-6 w-6" />
						<span className="text-lg font-semibold">Story to Manga Enhanced</span>
					</div>
					<p className="text-gray-400 mb-4">
						{language === 'zh'
							? '让每个人都能成为漫画创作者'
							: 'Empowering everyone to become a comic creator'
						}
					</p>
					<div className="flex justify-center space-x-6 text-sm text-gray-400">
						<a href="#" className="hover:text-white transition-colors">
							{language === 'zh' ? '关于我们' : 'About'}
						</a>
						<a href="#" className="hover:text-white transition-colors">
							{language === 'zh' ? '帮助中心' : 'Help'}
						</a>
						<a href="#" className="hover:text-white transition-colors">
							{language === 'zh' ? '隐私政策' : 'Privacy'}
						</a>
						<a href="https://github.com/feifeixp/story-to-manga-enhanced/issues/new" className="hover:text-white transition-colors">
							{language === 'zh' ? '反馈问题' : 'Report Issue'}
						</a>
					</div>
				</div>
			</footer>

			{/* Auth Modal */}
			<AuthModal
				isOpen={showAuthModal}
				onClose={() => setShowAuthModal(false)}
			/>

			{/* Comic Reader */}
			{selectedComic && (
				<ComicReader
					comic={selectedComic}
					onClose={() => setSelectedComic(null)}
				/>
			)}
		</div>
	);
}