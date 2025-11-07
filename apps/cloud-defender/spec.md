This is a specification for an app named Cloud Defender that provides a security management portal for a cloud service. 

## Implementation requirements

The app should be a HTML 5 web site with a single HTML file supported by a single JavaScript file for code and a single CSS file for visual themes.

The app should run completely in the browser. It will be hosted in a GitHub repo and accessed via GitHub Pages.

All user interface elements should have alt-text and Aria properties for accessibility. The interface should support keyboard navigation.

## Functionality

The app should enable users to navigate the pages in the navigation pane on the left. On the default "Overview" page, users can view the number of subscriptions (of which there should always be 1), the number of assessed resources (which should be based on the resources listed in the assessed_resources.csv file), attack paths (based on the attack_paths.csv file), and security alerts (based on the security_alerts.csv file).

When the user selects the "Inventory" page or clicks the "Assessed resources" count, the Inventory page should be displayed and list the resources in the assessed_resources.csv file.