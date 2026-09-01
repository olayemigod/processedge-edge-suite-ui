import frappe
from frappe.tests import IntegrationTestCase

from edgesuite_ui.access_control import (
	ACCESS_EDGESUITE_ONLY,
	ACCESS_FIELD,
	ACCESS_NATIVE_DESK,
	MODE_EDGESUITE_ONLY,
	MODE_NATIVE_DESK,
	MODE_WEBSITE,
	ensure_desk_access_field,
	get_access_mode,
)


class TestEdgeSuiteDeskAccess(IntegrationTestCase):
	BUSINESS_ROLE = "_EdgeSuite Test Business Role"
	SYSTEM_USER = "edgesuite-desk-test@example.com"
	WEBSITE_USER = "edgesuite-website-test@example.com"

	def setUp(self):
		super().setUp()
		ensure_desk_access_field()
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

	def test_access_selector_is_non_permission_user_field(self):
		field = frappe.get_meta("User").get_field(ACCESS_FIELD)
		self.assertIsNotNone(field)
		self.assertEqual(field.fieldtype, "Select")
		self.assertEqual(field.permlevel, 1)
		self.assertEqual(field.default, ACCESS_EDGESUITE_ONLY)
		self.assertIn(ACCESS_NATIVE_DESK, field.options)

	def test_website_user_remains_website_user(self):
		user = self.make_user(self.WEBSITE_USER)
		frappe.db.set_value("User", user.name, ACCESS_FIELD, ACCESS_NATIVE_DESK)
		user.reload()

		self.assertEqual(user.user_type, "Website User")
		self.assertEqual(get_access_mode(user.name), MODE_WEBSITE)

	def test_new_system_user_defaults_to_edgesuite_only(self):
		user = self.make_user(self.SYSTEM_USER)
		user.add_roles(self.BUSINESS_ROLE)
		user.reload()

		self.assertEqual(user.user_type, "System User")
		self.assertEqual(user.get(ACCESS_FIELD), ACCESS_EDGESUITE_ONLY)
		self.assertEqual(get_access_mode(user.name), MODE_EDGESUITE_ONLY)

	def test_selector_changes_interface_mode_without_changing_business_role(self):
		user = self.make_user(self.SYSTEM_USER)
		user.add_roles(self.BUSINESS_ROLE)
		user.reload()
		original_roles = set(frappe.get_roles(user.name))

		frappe.db.set_value("User", user.name, ACCESS_FIELD, ACCESS_NATIVE_DESK)
		user.reload()
		self.assertEqual(user.user_type, "System User")
		self.assertEqual(set(frappe.get_roles(user.name)), original_roles)
		self.assertEqual(get_access_mode(user.name), MODE_NATIVE_DESK)

		frappe.db.set_value("User", user.name, ACCESS_FIELD, ACCESS_EDGESUITE_ONLY)
		user.reload()
		self.assertEqual(user.user_type, "System User")
		self.assertEqual(set(frappe.get_roles(user.name)), original_roles)
		self.assertEqual(get_access_mode(user.name), MODE_EDGESUITE_ONLY)

	def test_administrator_keeps_native_recovery_access(self):
		self.assertEqual(get_access_mode("Administrator"), MODE_NATIVE_DESK)
