import frappe
from frappe.tests import IntegrationTestCase

from edgesuite_ui.access_control import (
	ADVANCED_DESK_ROLE,
	MODE_EDGESUITE_ONLY,
	MODE_NATIVE_DESK,
	MODE_WEBSITE,
	ensure_advanced_desk_role,
	get_access_mode,
)


class TestEdgeSuiteDeskAccess(IntegrationTestCase):
	BUSINESS_ROLE = "_EdgeSuite Test Business Role"
	SYSTEM_USER = "edgesuite-desk-test@example.com"
	WEBSITE_USER = "edgesuite-website-test@example.com"

	def setUp(self):
		super().setUp()
		ensure_advanced_desk_role()
		if not frappe.db.exists("Role", self.BUSINESS_ROLE):
			frappe.get_doc(
				{
					"doctype": "Role",
					"role_name": self.BUSINESS_ROLE,
					"desk_access": 1,
					"disabled": 0,
				}
			).insert(ignore_permissions=True)

		frappe.delete_doc_if_exists("User", self.SYSTEM_USER)
		frappe.delete_doc_if_exists("User", self.WEBSITE_USER)

	def tearDown(self):
		frappe.delete_doc_if_exists("User", self.SYSTEM_USER)
		frappe.delete_doc_if_exists("User", self.WEBSITE_USER)
		frappe.delete_doc_if_exists("Role", self.BUSINESS_ROLE)
		super().tearDown()

	def make_user(self, email):
		return frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "EdgeSuite",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)

	def test_marker_role_does_not_create_system_user_access(self):
		role = frappe.get_doc("Role", ADVANCED_DESK_ROLE)
		self.assertFalse(role.desk_access)

		user = self.make_user(self.WEBSITE_USER)
		user.add_roles(ADVANCED_DESK_ROLE)
		user.reload()

		self.assertEqual(user.user_type, "Website User")
		self.assertEqual(get_access_mode(user.name), MODE_WEBSITE)

	def test_system_user_without_marker_is_edgesuite_only(self):
		user = self.make_user(self.SYSTEM_USER)
		user.add_roles(self.BUSINESS_ROLE)
		user.reload()

		self.assertEqual(user.user_type, "System User")
		self.assertNotIn(ADVANCED_DESK_ROLE, frappe.get_roles(user.name))
		self.assertEqual(get_access_mode(user.name), MODE_EDGESUITE_ONLY)

	def test_marker_changes_interface_mode_without_removing_business_role(self):
		user = self.make_user(self.SYSTEM_USER)
		user.add_roles(self.BUSINESS_ROLE)
		user.reload()
		self.assertEqual(get_access_mode(user.name), MODE_EDGESUITE_ONLY)

		user.add_roles(ADVANCED_DESK_ROLE)
		user.reload()
		self.assertEqual(user.user_type, "System User")
		self.assertIn(self.BUSINESS_ROLE, frappe.get_roles(user.name))
		self.assertEqual(get_access_mode(user.name), MODE_NATIVE_DESK)

		user.remove_roles(ADVANCED_DESK_ROLE)
		user.reload()
		self.assertEqual(user.user_type, "System User")
		self.assertIn(self.BUSINESS_ROLE, frappe.get_roles(user.name))
		self.assertEqual(get_access_mode(user.name), MODE_EDGESUITE_ONLY)

	def test_administrator_keeps_native_recovery_access(self):
		self.assertEqual(get_access_mode("Administrator"), MODE_NATIVE_DESK)
