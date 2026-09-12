---
title: "{{ replace (trim .Name "0123456789-") "-" " " | title }}"
date: {{ .Date }}
slug: "{{ trim .Name "0123456789-" }}"
draft: true
categories: []
tags: []
---
