-- Auto-set admin users to unlimited predictions
UPDATE user_plans 
SET daily_prediction_limit = -1, plan = 'premium'
WHERE user_id IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
);

-- Create trigger to auto-upgrade admins when role is assigned
CREATE OR REPLACE FUNCTION public.auto_upgrade_admin_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    UPDATE user_plans
    SET daily_prediction_limit = -1, plan = 'premium'
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_admin_role_assigned
AFTER INSERT ON user_roles
FOR EACH ROW
WHEN (NEW.role = 'admin')
EXECUTE FUNCTION public.auto_upgrade_admin_plan();