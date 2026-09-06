create policy handoffs_sender_update on public.handoffs for update to authenticated
using (from_member_id = private.current_member_id(household_id) and status in ('SCHEDULED', 'READY'))
with check (from_member_id = private.current_member_id(household_id));
