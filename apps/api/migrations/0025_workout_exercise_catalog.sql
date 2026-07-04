-- 0025_workout_exercise_catalog — platform-owned seed data for AI grounding /
-- autocomplete only (same pattern as grocery.price_cache, 0018: not user data, no
-- RLS). Never a gate — workout.log_set always accepts freeform exercise names not in
-- this list; expand this list later without touching any application code.

create table workout.exercise_catalog (
  id text primary key,
  name text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null
);
grant select on workout.exercise_catalog to lifeos_app;

insert into workout.exercise_catalog (id, name, primary_muscle, secondary_muscles, equipment) values
  ('bench_press',      'Bench Press',      'chest',     '{triceps,shoulders}',   'barbell'),
  ('back_squat',       'Back Squat',       'quads',     '{glutes,hamstrings}',   'barbell'),
  ('deadlift',         'Deadlift',         'back',      '{hamstrings,glutes}',   'barbell'),
  ('overhead_press',   'Overhead Press',   'shoulders', '{triceps}',             'barbell'),
  ('barbell_row',      'Barbell Row',      'back',      '{biceps}',              'barbell'),
  ('pull_up',          'Pull-Up',          'back',      '{biceps}',              'bodyweight'),
  ('dumbbell_curl',    'Dumbbell Curl',    'biceps',    '{}',                    'dumbbell'),
  ('tricep_pushdown',  'Tricep Pushdown',  'triceps',   '{}',                    'cable'),
  ('leg_press',        'Leg Press',        'quads',     '{glutes}',              'machine'),
  ('lat_pulldown',     'Lat Pulldown',     'back',      '{biceps}',              'cable'),
  ('plank',            'Plank',            'core',      '{}',                    'bodyweight'),
  ('walking_lunge',    'Walking Lunge',    'quads',     '{glutes,hamstrings}',   'dumbbell')
on conflict (id) do nothing;
