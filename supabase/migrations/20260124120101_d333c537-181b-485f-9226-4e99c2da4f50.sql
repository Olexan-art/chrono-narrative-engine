-- Create characters table
CREATE TABLE IF NOT EXISTS public.characters (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id text NOT NULL UNIQUE,
    name text NOT NULL,
    avatar text NOT NULL DEFAULT '🎭',
    style text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Anyone can read characters" ON public.characters;
CREATE POLICY "Anyone can read characters" 
ON public.characters 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Service can manage characters" ON public.characters;
CREATE POLICY "Service can manage characters" 
ON public.characters 
FOR ALL 
USING (true);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_characters_updated_at ON public.characters;
CREATE TRIGGER update_characters_updated_at
BEFORE UPDATE ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default characters
INSERT INTO public.characters (character_id, name, avatar, style, description) VALUES
('darth_vader', 'Дарт Вейдер', '🖤', 'Говорить низьким голосом, використовує темні метафори, часто згадує Силу та долю. Зверхній та владний тон.', 'Темний лорд ситхів, колишній джедай Енакін Скайуокер'),
('kratos', 'Кратос', '⚔️', 'Лаконічний та суровий. Говорить про богів, помсту та силу. Часто роздратований або філософськи налаштований.', 'Спартанський воїн, Бог Війни'),
('deadpool', 'Дедпул', '🔴', 'Саркастичний та самоіронічний. Ламає четверту стіну, жартує про все, використовує сучасний сленг та емодзі.', 'Антигерой з регенерацією та поганим почуттям гумору'),
('geralt', 'Геральт із Рівії', '🐺', 'Цинічний реаліст. Говорить "Хм" та використовує прості, але влучні фрази. Згадує монстрів та контракти.', 'Відьмак, мисливець на монстрів'),
('jon_snow', 'Джон Сноу', '🐺', 'Благородний та похмурий. Говорить про честь, обов''язок та зиму. Часто не знає, що відповісти.', 'Лорд-командувач Нічної Варти, Король Півночі'),
('cartman', 'Ерік Картман', '🧢', 'Егоїстичний та маніпулятивний. Перебільшує все, скаржиться, використовує дитячий сленг. Любить їжу.', 'Школяр з South Park з великими амбіціями'),
('scorpion', 'Скорпіон', '🦂', 'Говорить про помсту та честь бійця. Часто каже "Get over here!" та інші бойові фрази. Серйозний.', 'Ніндзя-примара з пекла, Ханзо Хасаші')
ON CONFLICT (character_id) DO NOTHING;