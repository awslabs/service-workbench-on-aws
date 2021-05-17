describe('page routing', () => {
  describe('should navigate to /users page correctly', () => {
    it('should redirect researchers trying to access /users page', () => {
      cy.login('researcher');
      cy.visit('/users');
      cy.get("div[data-testid='page-title'] div").contains('Dashboard');
    });
    it('should allow admin to access /users page', () => {
      cy.login('admin');
      cy.visit('/users');
      cy.get("div[data-testid='users-table']");
    });
  });
});
