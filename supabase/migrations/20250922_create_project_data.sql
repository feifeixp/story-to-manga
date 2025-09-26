-- 创建项目完整数据存储表
-- 用于存储项目的所有详细数据，包括故事、分析、面板等

CREATE TABLE IF NOT EXISTS project_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    
    -- 基本项目内容
    story TEXT DEFAULT '',
    style TEXT DEFAULT 'manga',
    
    -- 故事分析和分解数据
    story_analysis JSONB,
    story_breakdown JSONB,
    
    -- 角色和设置参考
    character_references JSONB DEFAULT '[]'::jsonb,
    uploaded_character_references JSONB DEFAULT '[]'::jsonb,
    uploaded_setting_references JSONB DEFAULT '[]'::jsonb,
    
    -- 生成的面板
    generated_panels JSONB DEFAULT '[]'::jsonb,
    
    -- 配置信息
    image_size JSONB,
    tags JSONB DEFAULT '[]'::jsonb,
    ai_model TEXT DEFAULT 'auto',
    generation_state JSONB,
    
    -- 元数据
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_data_project_id ON project_data(project_id);
CREATE INDEX IF NOT EXISTS idx_project_data_updated_at ON project_data(updated_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_project_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_data_updated_at
    BEFORE UPDATE ON project_data
    FOR EACH ROW
    EXECUTE FUNCTION update_project_data_updated_at();

-- 添加外键约束（如果projects表存在）
-- ALTER TABLE project_data 
-- ADD CONSTRAINT fk_project_data_project_id 
-- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- 添加注释
COMMENT ON TABLE project_data IS '项目完整数据存储表，包含故事、分析、面板等所有详细信息';
COMMENT ON COLUMN project_data.project_id IS '关联的项目ID';
COMMENT ON COLUMN project_data.story IS '项目故事内容';
COMMENT ON COLUMN project_data.style IS '漫画风格';
COMMENT ON COLUMN project_data.story_analysis IS '故事分析结果';
COMMENT ON COLUMN project_data.story_breakdown IS '故事分解结果';
COMMENT ON COLUMN project_data.character_references IS '角色参考信息';
COMMENT ON COLUMN project_data.generated_panels IS '生成的面板数据';
COMMENT ON COLUMN project_data.metadata IS '项目元数据，包含统计信息等';
