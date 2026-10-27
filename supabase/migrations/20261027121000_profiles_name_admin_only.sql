-- Ім'я й пошту користувача змінює лише адміністратор (матриця прав PM, requirements/product.md: «Change a user's name or
-- email (including own)» — employee —, manager —, admin yes; зріз WS10).
--
-- Шаблонна міграція 20261012000000 давала `authenticated` `grant update (full_name)` і політику `profiles_update_own`, щоб
-- користувач міг змінити своє ім'я. Після відповіді PM (issue «Питання до вимог» про ім'я, пошту й пароль) це суперечить
-- матриці: працівник через Data API міг би змінити власне ім'я. У застосунку (`src/`) таблицю `profiles` лише читають.
--
-- Роль, як і раніше, змінити не можна: `grant update (role)` ніколи не видавався. Зміну імені адміністратором додає зріз WS10
-- (окрема функція бази з перевіркою ролі), не пряма політика `update`.
--
-- РИЗИК: після міграції `authenticated` не має жодного `grant update` на `public.profiles`; дані не змінюються. Відкат — нова
-- міграція: повернути `grant update (full_name)` і політику.

revoke update (full_name) on table public.profiles from authenticated;

drop policy if exists profiles_update_own on public.profiles;
