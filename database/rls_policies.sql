-- RLS 策略文件 - Story to Manga
-- 请在创建完表结构后执行这个脚本

-- 1. 项目表 RLS 策略
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own projects" ON public.projects
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 2. 项目文件表 RLS 策略
CREATE POLICY "Users can view their project files" ON public.project_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (
        (auth.uid() IS NOT NULL AND projects.user_id = auth.uid()) OR
        (auth.uid() IS NULL AND projects.device_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can insert their project files" ON public.project_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (
        (auth.uid() IS NOT NULL AND projects.user_id = auth.uid()) OR
        (auth.uid() IS NULL AND projects.device_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can update their project files" ON public.project_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (
        (auth.uid() IS NOT NULL AND projects.user_id = auth.uid()) OR
        (auth.uid() IS NULL AND projects.device_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can delete their project files" ON public.project_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (
        (auth.uid() IS NOT NULL AND projects.user_id = auth.uid()) OR
        (auth.uid() IS NULL AND projects.device_id IS NOT NULL)
      )
    )
  );

-- 3. 生成任务表 RLS 策略
CREATE POLICY "Users can view their own generation jobs" ON public.generation_jobs
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own generation jobs" ON public.generation_jobs
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own generation jobs" ON public.generation_jobs
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 4. 分享作品表 RLS 策略
CREATE POLICY "Anyone can view public shared works" ON public.shared_works
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own shared works" ON public.shared_works
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own shared works" ON public.shared_works
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own shared works" ON public.shared_works
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own shared works" ON public.shared_works
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 5. 评论表 RLS 策略
CREATE POLICY "Anyone can view comments on public works" ON public.work_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_works 
      WHERE shared_works.id = work_comments.shared_work_id 
      AND shared_works.visibility = 'public'
    )
  );

CREATE POLICY "Users can insert comments" ON public.work_comments
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own comments" ON public.work_comments
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own comments" ON public.work_comments
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 6. 点赞表 RLS 策略
CREATE POLICY "Anyone can view likes on public works" ON public.work_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_works 
      WHERE shared_works.id = work_likes.shared_work_id 
      AND shared_works.visibility = 'public'
    )
  );

CREATE POLICY "Users can insert likes" ON public.work_likes
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own likes" ON public.work_likes
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 7. 用户资料表 RLS 策略
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 8. 设备信息表 RLS 策略（匿名用户可以管理自己的设备信息）
CREATE POLICY "Allow device info management" ON public.device_info
  FOR ALL USING (true);

-- 完成
SELECT 'RLS policies created successfully!' as message;
