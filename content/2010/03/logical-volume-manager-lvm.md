---
title: Logical Volume Manager - LVM
date: '2010-03-11T20:25:03+00:00'
slug: logical-volume-manager-lvm
categories:
- System Administration
tags:
- fdisk
- lvm
---

This page covers some of the basics of using LVM. Please ensure that you back up any important data on any had drive or partition you wish to use for LVM.

I take no responsibility for any data loss if you choose to use any of the commands on this page

### Installation

For the purposes of this guide, I am using **Ubuntu Hardy 8.04** and the package manager **apt** but this should work with any installation of LVM

<!--more-->

First off, you need to install LVM. For my install it was as simple as:

```console
# apt-get install lvm2
```

Once this is complete you should have a working install of LVM. To check, look for the following binaries

```console
$ which lvcreate
 /sbin/lvcreate
 $ which pvcreate
 /sbin/pvcreate
 $ which vgcreate
 /sbin/vgcreate
```

If you do not have the three binaries above then you need to double check you installed LVM correctly.

### Setup

The very first thing you need to do (After backing up any data that needs to be backed up of course) is decide which disks or partitions you wish to use. Once this is done we need to set the correct type of partition for use with LVM. In my example, I will be using a partition that takes up an entire disk.

To set up the partition we use **fdisk**. As root we need to:

```console
# fdisk /dev/sda

The number of cylinders for this disk is set to 1125.
 There is nothing wrong with that, but this is larger than 1024,
 and could in certain setups cause problems with:
 1) software that runs at boot time (e.g., old versions of LILO)
 2) booting and partitioning software from other OSs
 (e.g., DOS FDISK, OS/2 FDISK)

Command (m for help):
```

If you already have any partitions on this disk you should remove them by typing d and selecting each partition as they are listed.

Once this is done, we need to create a new partition

```console
Command (m for help): n
 Command action
 e extended
 p primary partition (1-4)
 p
 Partition number (1-4): 1
 First cylinder (1-1125, default 1):
 Using default value 1
 Last cylinder or +size or +sizeM or +sizeK (1-1125, default 1125):
 Using default value 1125

Command (m for help):
```

And then we change its type to **Linux LVM**

```console
Command (m for help): t
 Selected partition 1
 Hex code (type L to list codes): 8e
 Changed system type of partition 1 to 8e (Linux LVM)

Command (m for help):
```

To finalize the partitioning, we type **w**:

```console
Command (m for help): w
 The partition table has been altered!

Calling ioctl() to re-read partition table.
 Syncing disks.
```

This step will need to be repeated for every disk (or partition) you wish to use in your LVM Array.

### pvcreate

Once all your disks have been partitioned you need to write LVM Superblock headers into them, this is done with the **pvcreate** command:

```console
# pvcreate /dev/sda1 /dev/sdb1
 Physical volume "/dev/sda1" successfully created
 Physical volume "/dev/sdb1" successfully created
```

Thats it, you now have all the nessecery information for LVM Arrays in the superblocks of the disks. This will be amended at a later stage automatically by LVM to include the UUIDs for each disk/partition in the event of an array failure.

### vgcreate

Now that is overwith we need to create a volume group to house the logical disk. In this example I am going to use a volume group of **VolGrp001** and a logical disk name of **LogVol001**

```console
# vgcreate VolGrp001 /dev/sda1 /dev/sdb1
 Volume group "VolGrp001" successfully created
```

### lvcreate

Now we need to create the new logical volume and add it to the newly created volume group.

Whilst there are many more options available with these commands I've omitted most of them for ease. Feel free to have a play around, just take note to be careful as if you mess something up you could lose all the data you have on the hard drives you are trying to use in an LVM Array.

To create the new array we use the following (the flag after LogVol001 is a lowercase L):

```console
# lvcreate --name LogVol001 -l 100%VG VolGrp001
 Rounding up size to full physical extent 2793.96 GB
 Logical volume "LogVol001" created
```

Thats it, all the hard work of setting up LVM is done. All that is left is to make it contain a usable format and then stand in awe as you have a huge, seemingly single disk to store all your data

In most cases, I would imagine you want to use the newly created LVM Device for data storage. My Choice of filesystem is **ext3** however you can use any you like along with any settings you choose.

To create a useable ext3 format on the LVM Device we use **mkfs.ext3**:

```console
# mkfs.ext3 -m 0 /dev/VolGrp001/LogVol001
```

The above command might take some time depending on how large the array is and how well your disks perform. It's worth noting that the -m 0 option gives you some more space. By default ext3 reserves 5% of the total space for the super user. If you are using this to store data the super user would not need this

Once this is done you can now happily mount the new file system and start using it (**/mnt/lvm** is my mount point of choice):

```console
# mount /dev/VolGrp001/LogVol001 /mnt/lvm
```

### Extending LVM Devices

So, you've had your LVM Device up and running for a while and it's starting to get full. You can happily add extra disks/partitions to your LVM device.

Firstly, as with creating a new LVM Array you need to [partition the disk](#setup) to **Linux LVM**. This is done with the **pvcreate** command:

```console
# pvcreate /dev/sdc1
 Physical volume "/dev/sdc1" successfully created
```

The next tast will be to add the new disk or partition to the same Volume Group as the Logical volume we want to extend. To do this we use the **vgextend**

**WARNING**: It is recommended that before you make any modifications to a logical volume that you unmount it first

```console
# vgextend VolGrp001 /dev/sdc1
```

**/dev/sdc1** has now been added to the volume group. Now we need to extend the size of the logical volume (the same as earlier, this flag is a lowercase L)

```console
# lvextend -l +100%FREE /dev/VolGrp001/LogVol001 /dev/sdc1
```

The above adds 931.32GB of usable space to the Logical Volume and tells it where this space actually is, /dev/sdc1. The next task is to resize the partition to fill the Device. It is the same as if you were resizing an ext3 patition on a physical disk. First we check the file system for errors (Make sure it is unmounted first) and then we resize the partition to take up the entirety of the disk space available

```console
# e2fsck -f /dev/VolGrp001/LogVol001
# resize2fs /dev/VolGrp001/LogVol001
```

Again, this make take some time depending on the size of the file system and how well your hard drives perform. Once all this is done however, you're ready to go. Re mount the file system and it should have increased by 931.32GB or whatever you increased it by.
