(window.webpackJsonp=window.webpackJsonp||[]).push([[44],{101:function(e,t,n){"use strict";n.r(t),n.d(t,"frontMatter",(function(){return o})),n.d(t,"metadata",(function(){return i})),n.d(t,"rightToc",(function(){return u})),n.d(t,"default",(function(){return s}));var r=n(1),a=n(6),c=(n(0),n(116));const o={id:"create_member_account",title:"Create an AWS Account",sidebar_label:"Create an AWS Account"},i={unversionedId:"user_guide/sidebar/admin/accounts/aws_accounts/create_member_account",id:"user_guide/sidebar/admin/accounts/aws_accounts/create_member_account",isDocsHomePage:!1,title:"Create an AWS Account",description:"When you attempt to create a Member AWS Account, the Main AWS Account will assume a role in the Master AWS Account. Once the role has been assumed, it will then create a Member AWS Account.",source:"@site/docs/user_guide/sidebar/admin/accounts/aws_accounts/create_member_account.md",slug:"/user_guide/sidebar/admin/accounts/aws_accounts/create_member_account",permalink:"/docs/user_guide/sidebar/admin/accounts/aws_accounts/create_member_account",version:"current",sidebar_label:"Create an AWS Account",sidebar:"docs",previous:{title:"Introduction to AWS Accounts",permalink:"/docs/user_guide/sidebar/admin/accounts/aws_accounts/introduction"},next:{title:"Invite an AWS Member Account",permalink:"/docs/user_guide/sidebar/admin/accounts/aws_accounts/invite_member_account"}},u=[],b={rightToc:u};function s(e){let t=e.components,n=Object(a.a)(e,["components"]);return Object(c.b)("wrapper",Object(r.a)({},b,n,{components:t,mdxType:"MDXLayout"}),Object(c.b)("p",null,"When you attempt to create a ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Member AWS Account")),", the ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Main AWS Account"))," will assume a role in the ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Master AWS Account")),". Once the role has been assumed, it will then create a ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Member AWS Account")),"."),Object(c.b)("p",null,"Once the ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Member AWS Account"))," has been created, the ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Main AWS Account"))," will assume a role in that account and launch a CloudFormation template to build resources (VPC, Subnet, ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"cross_account_execution_role"}),Object(c.b)("strong",{parentName:"a"},"Cross Account Execution Role")),")."),Object(c.b)("p",null,"To create a new ",Object(c.b)("a",Object(r.a)({parentName:"p"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Member AWS Account")),", follow these steps:"),Object(c.b)("ol",null,Object(c.b)("li",{parentName:"ol"},"In the portal navigate to the ",Object(c.b)("strong",{parentName:"li"},"Accounts")," page using the menu on the left."),Object(c.b)("li",{parentName:"ol"},"Click the ",Object(c.b)("strong",{parentName:"li"},"AWS Accounts")," tab along the top."),Object(c.b)("li",{parentName:"ol"},"Click the ",Object(c.b)("strong",{parentName:"li"},"Create AWS Account")," button."),Object(c.b)("li",{parentName:"ol"},"Type a name for the AWS Account in the ",Object(c.b)("strong",{parentName:"li"},"Account Name")," field."),Object(c.b)("li",{parentName:"ol"},"Type an email address for the AWS Account in the ",Object(c.b)("strong",{parentName:"li"},"AWS Account Email")," field."),Object(c.b)("li",{parentName:"ol"},"Provide the ",Object(c.b)("a",Object(r.a)({parentName:"li"},{href:"master_role"}),Object(c.b)("strong",{parentName:"a"},"Master Role"))," ARN for the ",Object(c.b)("a",Object(r.a)({parentName:"li"},{href:"introduction"}),Object(c.b)("strong",{parentName:"a"},"Master AWS Account"))," in the ",Object(c.b)("strong",{parentName:"li"},"Master Role Arn")," field."),Object(c.b)("li",{parentName:"ol"},"Type the External ID for the AWS Account in the ",Object(c.b)("strong",{parentName:"li"},"External ID")," field."),Object(c.b)("li",{parentName:"ol"},"Type a description for the AWS Account in the ",Object(c.b)("strong",{parentName:"li"},"Description")," field.")))}s.isMDXComponent=!0},116:function(e,t,n){"use strict";n.d(t,"a",(function(){return l})),n.d(t,"b",(function(){return d}));var r=n(0),a=n.n(r);function c(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){c(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function u(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},c=Object.keys(e);for(r=0;r<c.length;r++)n=c[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var c=Object.getOwnPropertySymbols(e);for(r=0;r<c.length;r++)n=c[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var b=a.a.createContext({}),s=function(e){var t=a.a.useContext(b),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},l=function(e){var t=s(e.components);return a.a.createElement(b.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return a.a.createElement(a.a.Fragment,{},t)}},m=a.a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,c=e.originalType,o=e.parentName,b=u(e,["components","mdxType","originalType","parentName"]),l=s(n),m=r,d=l["".concat(o,".").concat(m)]||l[m]||p[m]||c;return n?a.a.createElement(d,i(i({ref:t},b),{},{components:n})):a.a.createElement(d,i({ref:t},b))}));function d(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var c=n.length,o=new Array(c);o[0]=m;var i={};for(var u in t)hasOwnProperty.call(t,u)&&(i[u]=t[u]);i.originalType=e,i.mdxType="string"==typeof e?e:r,o[1]=i;for(var b=2;b<c;b++)o[b]=n[b];return a.a.createElement.apply(null,o)}return a.a.createElement.apply(null,n)}m.displayName="MDXCreateElement"}}]);